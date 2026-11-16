import java.math.BigInteger;

class Solution {
    public boolean canPartition(int[] nums) {
        int total = 0;                              //@init
        BigInteger bits = BigInteger.ONE;           // 第 j 位是 1：能凑出和 j //@init
        for (int x : nums) {                        //@add
            total += x;                             //@add
            bits = bits.or(bits.shiftLeft(x));      //@add
        }
        return total % 2 == 0 && bits.testBit(total / 2);   //@done
    }
}
