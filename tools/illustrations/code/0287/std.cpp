class Solution {
public:
    int findDuplicate(vector<int>& nums) {
        int slow = 0, fast = 0;                         //@init
        while (true) {                                  // 把 i -> nums[i] 看成链表 //@run
            slow = nums[slow];                          //@run
            fast = nums[nums[fast]];                    //@run
            if (slow == fast) {                         //@run,meet
                break;                                  //@meet
            }
        }
        slow = 0;                                       // 一个回到起点，再同速走 //@reset
        while (slow != fast) {                          //@walk
            slow = nums[slow];                          //@walk
            fast = nums[fast];                          //@walk
        }
        return slow;                                    // 相遇点就是环的入口 //@done
    }
};
