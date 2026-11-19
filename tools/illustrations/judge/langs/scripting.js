// Ruby、PHP：和 Python 一样在运行时按签名把 JSON 输入变成参数（prelude.rb、prelude.php，和 runner.py 同一套）。
// 只给远端运行器（tools/runner）拼练习程序用；官方题解没有这两种语言的版本。
const fs = require("fs"), path = require("path");

module.exports = {
  ruby: { id: "ruby", parts: { prelude: fs.readFileSync(path.join(__dirname, "../prelude/prelude.rb"), "utf8") } },
  php: { id: "php", parts: { prelude: fs.readFileSync(path.join(__dirname, "../prelude/prelude.php"), "utf8") } },
};
