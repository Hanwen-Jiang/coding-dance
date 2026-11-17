type MinStack struct {
	stack []int
	mins  []int // mins 的最后一个是当前栈里的最小值
}

func Constructor() MinStack {
	return MinStack{stack: []int{}, mins: []int{}} //@init
}

func (this *MinStack) Push(val int) {
	this.stack = append(this.stack, val) //@push
	m := val                             //@push
	if n := len(this.mins); n > 0 && this.mins[n-1] < m { //@push
		m = this.mins[n-1] //@push
	}
	this.mins = append(this.mins, m) //@push
}

func (this *MinStack) Pop() {
	this.stack = this.stack[:len(this.stack)-1] //@pop
	this.mins = this.mins[:len(this.mins)-1]    // 和主栈同步弹出 //@pop
}

func (this *MinStack) Top() int {
	return this.stack[len(this.stack)-1] //@top
}

func (this *MinStack) GetMin() int {
	return this.mins[len(this.mins)-1] //@getMin
}
