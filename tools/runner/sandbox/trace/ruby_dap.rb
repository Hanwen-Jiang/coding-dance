#!/usr/bin/env ruby
# frozen_string_literal: true

# Ruby Debug Adapter Protocol (DAP) 服务端：基于标准库 TracePoint + Binding 实现，零第三方 gem 依赖。
# 用法：ruby -E UTF-8:UTF-8 -W0 ruby_dap.rb <userFullPath> <off> <n> <stdinFile> <scriptPath> [scriptArgs...]
require "json"
require "thread"

USER_PATH = File.realpath(File.expand_path(ARGV[0]))
USER_NAME = File.basename(USER_PATH)
OFF = ARGV[1].to_i
N = ARGV[2].to_i
STDIN_FILE = ARGV[3].to_s
SCRIPT_PATH = File.realpath(File.expand_path(ARGV[4]))
SCRIPT_ARGS = ARGV[5..] || []

DAP_IN = $stdin.dup
DAP_OUT = $stdout.dup
DAP_IN.binmode
DAP_OUT.binmode
DAP_IN.sync = true
DAP_OUT.sync = true

if !STDIN_FILE.empty? && File.exist?(STDIN_FILE)
  $stdin.reopen(File.open(STDIN_FILE, "rb"))
else
  $stdin.reopen(File.open(IO::NULL, "rb"))
end

OUT_R, OUT_W = IO.pipe
ERR_R, ERR_W = IO.pipe
$stdout.reopen(OUT_W)
$stderr.reopen(ERR_W)
OUT_W.close
ERR_W.close
$stdout.sync = true
$stderr.sync = true

OUT_LOCK = Mutex.new
$out_seq = 0

def next_seq
  $out_seq += 1
end

def send_msg(obj)
  OUT_LOCK.synchronize do
    obj["seq"] ||= next_seq
    raw = JSON.generate(obj).encode("UTF-8")
    hdr = "Content-Length: #{raw.bytesize}\r\n\r\n"
    begin
      DAP_OUT.write(hdr)
      DAP_OUT.write(raw)
      DAP_OUT.flush
    rescue IOError, Errno::EPIPE
    end
  end
end

def send_response(req, success: true, body: {}, message: nil)
  resp = {
    "seq" => next_seq,
    "type" => "response",
    "request_seq" => req["seq"].to_i,
    "success" => success,
    "command" => req["command"].to_s,
  }
  resp["body"] = body unless body.nil?
  resp["message"] = message if !success && message
  send_msg(resp)
end

def send_event(event, body = {})
  send_msg({ "seq" => next_seq, "type" => "event", "event" => event, "body" => body })
end

def start_pump(io, category)
  done = Queue.new
  Thread.new do
    begin
      while (chunk = io.readpartial(4096))
        text = chunk.force_encoding("UTF-8")
        text = text.encode("UTF-8", invalid: :replace, undef: :replace) unless text.valid_encoding?
        send_event("output", { "category" => category, "output" => text }) unless text.empty?
      end
    rescue EOFError, IOError
    ensure
      begin
        io.close
      rescue IOError
      end
      done << true
    end
  end
  done
end

OUT_DONE = start_pump(OUT_R, "stdout")
ERR_DONE = start_pump(ERR_R, "stderr")

def safe_inspect(val, max_len = 200)
  s = val.inspect
  s.length > max_len ? "#{s[0, max_len - 1]}…" : s
rescue StandardError => e
  "<#{val.class}: #{e.message}>"
end

def expandable?(val)
  case val
  when Array, Hash
    !val.empty?
  else
    !val.instance_variables.empty? && !val.is_a?(Numeric) && !val.is_a?(String) && !val.is_a?(Symbol)
  end
end

class RubyDapState
  attr_accessor :breakpoints, :launched, :config_done, :stop_on_entry, :terminated

  def initialize
    @mu = Mutex.new
    @cv = ConditionVariable.new
    @start_cv = ConditionVariable.new
    @breakpoints = {} # line => true
    @launched = false
    @config_done = false
    @stop_on_entry = false
    @terminated = false
    @paused = false
    @step_mode = nil # nil | :in | :over | :out
    @target_depth = 0
    @target_thread = nil
    @cur_binding = nil
    @cur_method = "<main>"
    @cur_line = 0
    @frame_refs = {}
    @var_refs = {}
    @next_ref = 100
    @path_cache = {}
  end

  def real_path(p)
    return @path_cache[p] if @path_cache.key?(p)
    @path_cache[p] = File.realpath(p)
  rescue StandardError
    @path_cache[p] = p
  end

  def alloc_ref(map, val)
    @next_ref += 1
    map[@next_ref] = val
    @next_ref
  end

  def maybe_start!
    @mu.synchronize do
      @start_cv.broadcast if @launched && @config_done
    end
  end

  def wait_start
    @mu.synchronize do
      @step_mode = :in if @stop_on_entry
      @start_cv.wait(@mu) until (@launched && @config_done) || @terminated
    end
  end

  def on_line(tp)
    return if @terminated || @paused || Thread.current[:_dap_eval]
    rp = @path_cache[tp.path] ||= real_path(tp.path)
    return unless rp == USER_PATH
    ln = tp.lineno
    return unless ln > OFF && ln <= OFF + N

    hit_bp = @breakpoints.key?(ln)
    reason = nil
    should_stop = false

    @mu.synchronize do
      if hit_bp
        reason = "breakpoint"
        should_stop = true
      elsif @step_mode && (@target_thread.nil? || @target_thread == Thread.current)
        depth = caller_locations.size
        if @step_mode == :in || depth <= @target_depth
          reason = @stop_on_entry ? "entry" : "step"
          should_stop = true
        end
      end

      return unless should_stop

      @stop_on_entry = false
      @step_mode = nil
      @paused = true
      @cur_binding = tp.binding
      @cur_method = (tp.callee_id || "<main>").to_s
      @cur_line = ln
      @target_depth = caller_locations.size
      @target_thread = Thread.current
      @frame_refs.clear
      @var_refs.clear

      send_event("stopped", { "reason" => reason, "threadId" => 1, "allThreadsStopped" => true })
      @cv.wait(@mu) while @paused && !@terminated
    end
  end

  def set_breakpoints(lines)
    @mu.synchronize do
      @breakpoints.clear
      lines.each { |ln| @breakpoints[ln] = true if ln > OFF && ln <= OFF + N }
    end
  end

  def resume(action)
    @mu.synchronize do
      case action
      when "next"
        @step_mode = :over
      when "stepIn"
        @step_mode = :in
      when "stepOut"
        @step_mode = :out
        @target_depth = [@target_depth - 1, 0].max
      else
        @step_mode = nil
        @target_thread = nil
      end
      @paused = false
      @cv.broadcast
    end
  end

  def stack_frames
    @mu.synchronize do
      return [] unless @paused && @cur_binding
      fid = alloc_ref(@frame_refs, @cur_binding)
      [{
        "id" => fid,
        "name" => @cur_method,
        "line" => @cur_line,
        "column" => 1,
        "source" => { "name" => USER_NAME, "path" => USER_PATH },
      }]
    end
  end

  def scopes(frame_id)
    @mu.synchronize do
      b = @frame_refs[frame_id] || @cur_binding
      return [] unless b
      lref = alloc_ref(@var_refs, [:locals, b])
      [{ "name" => "Locals", "variablesReference" => lref, "expensive" => false }]
    end
  end

  def format_var(name, val)
    vref = expandable?(val) ? alloc_ref(@var_refs, [:obj, val]) : 0
    {
      "name" => name.to_s,
      "value" => safe_inspect(val),
      "type" => val.class.name,
      "variablesReference" => vref,
    }
  end

  def variables(vref)
    @mu.synchronize do
      entry = @var_refs[vref]
      return [] unless entry
      kind, payload = entry
      if kind == :locals
        out = []
        payload.local_variables.each do |sym|
          next if sym.to_s.start_with?("__j_")
          val = payload.local_variable_get(sym)
          out << format_var(sym.to_s, val)
        end
        receiver = payload.receiver
        if !receiver.is_a?(Module) && receiver.class != Object && !receiver.instance_variables.empty?
          receiver.instance_variables.each do |iv|
            out << format_var(iv.to_s, receiver.instance_variable_get(iv))
          end
        end
        return out
      end

      out = []
      case payload
      when Array
        payload.first(60).each_with_index { |v, i| out << format_var("[#{i}]", v) }
        out << { "name" => "…", "value" => "共 #{payload.size} 项", "variablesReference" => 0 } if payload.size > 60
      when Hash
        payload.each_with_index do |(k, v), i|
          if i >= 60
            out << { "name" => "…", "value" => "共 #{payload.size} 项", "variablesReference" => 0 }
            break
          end
          out << format_var(safe_inspect(k, 40), v)
        end
      else
        payload.instance_variables.first(60).each { |iv| out << format_var(iv.to_s, payload.instance_variable_get(iv)) }
      end
      out
    end
  end

  def evaluate(expr, frame_id)
    b = @mu.synchronize { @frame_refs[frame_id] || @cur_binding }
    return [false, "<未暂停>", 0, nil] unless b
    prev = Thread.current[:_dap_eval]
    Thread.current[:_dap_eval] = true
    val = b.eval(expr)
    @mu.synchronize do
      vref = expandable?(val) ? alloc_ref(@var_refs, [:obj, val]) : 0
      [true, safe_inspect(val), vref, val.class.name]
    end
  rescue Exception => e
    [false, "#{e.class}: #{e.message}", 0, nil]
  ensure
    Thread.current[:_dap_eval] = prev
  end
end

STATE = RubyDapState.new

def run_target
  STATE.wait_start
  return if STATE.terminated

  ARGV.replace(SCRIPT_ARGS)
  exit_code = 0
  tp = TracePoint.new(:line) { |t| STATE.on_line(t) }
  tp.enable
  begin
    load SCRIPT_PATH
  rescue SystemExit => e
    exit_code = e.status
  rescue Exception => e
    exit_code = 1
    $stderr.puts "#{e.class}: #{e.message}"
    $stderr.puts e.backtrace.first(12).join("\n") if e.backtrace
  ensure
    tp.disable
    begin
      $stdout.flush
      $stderr.flush
      $stdout.reopen(IO::NULL, "w")
      $stderr.reopen(IO::NULL, "w")
    rescue IOError
    end
    # Allow pump threads to drain quickly
    sleep 0.05
    send_event("exited", { "exitCode" => exit_code })
    send_event("terminated", {})
  end
end

def read_dap_frame
  content_len = -1
  loop do
    line = DAP_IN.gets("\n")
    return nil if line.nil?
    s = line.strip
    break if s.empty?
    if s.include?(":")
      k, v = s.split(":", 2)
      content_len = v.strip.to_i if k.strip.casecmp("content-length").zero?
    end
  end
  return nil if content_len < 0
  body = DAP_IN.read(content_len)
  return nil if body.nil? || body.bytesize < content_len
  JSON.parse(body.force_encoding("UTF-8"))
end

def handle_request(req)
  cmd = req["command"].to_s
  args = req["arguments"] || {}
  case cmd
  when "initialize"
    send_response(req, body: {
      "supportsConfigurationDoneRequest" => true,
      "supportsEvaluateForHovers" => true,
      "supportsTerminateRequest" => true,
    })
    send_event("initialized", {})
  when "launch"
    STATE.stop_on_entry = true if args["stopOnEntry"]
    STATE.launched = true
    send_response(req)
    STATE.maybe_start!
  when "setBreakpoints"
    bps = Array(args["breakpoints"])
    lines = bps.map { |b| b["line"].to_i }.select(&:positive?)
    STATE.set_breakpoints(lines)
    send_response(req, body: {
      "breakpoints" => lines.map { |ln| { "verified" => (ln > OFF && ln <= OFF + N), "line" => ln } },
    })
  when "configurationDone"
    STATE.config_done = true
    send_response(req)
    STATE.maybe_start!
  when "threads"
    send_response(req, body: { "threads" => [{ "id" => 1, "name" => "main" }] })
  when "stackTrace"
    frames = STATE.stack_frames
    send_response(req, body: { "stackFrames" => frames, "totalFrames" => frames.size })
  when "scopes"
    send_response(req, body: { "scopes" => STATE.scopes(args["frameId"].to_i) })
  when "variables"
    send_response(req, body: { "variables" => STATE.variables(args["variablesReference"].to_i) })
  when "evaluate"
    ok, res, vref, tp = STATE.evaluate(args["expression"].to_s, args["frameId"].to_i)
    if ok
      send_response(req, body: { "result" => res, "type" => tp, "variablesReference" => vref })
    else
      send_response(req, success: false, body: nil, message: res)
    end
  when "continue", "next", "stepIn", "stepOut"
    STATE.resume(cmd)
    send_response(req, body: cmd == "continue" ? { "allThreadsContinued" => true } : {})
  when "disconnect", "terminate"
    STATE.terminated = true
    STATE.resume("continue")
    STATE.maybe_start!
    send_response(req)
    exit!(0)
  else
    send_response(req)
  end
end

Thread.new { run_target }

loop do
  req = read_dap_frame
  break if req.nil?
  handle_request(req)
end

STATE.terminated = true
STATE.resume("continue")
STATE.maybe_start!
