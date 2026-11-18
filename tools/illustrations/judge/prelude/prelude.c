/* 判题程序的 C 部分（接在用户代码后面）：建参数、记下本用例建出的节点、把结果写成 JSON。名字都以 j 开头，免得和题解撞上 */
#include <unistd.h>

typedef struct { char *p; size_t n, cap; } JBuf;

static void jPut(JBuf *b, const char *s, size_t n) {
    if (b->n + n + 1 > b->cap) { b->cap = (b->n + n + 1) * 2; b->p = (char *)realloc(b->p, b->cap); }
    memcpy(b->p + b->n, s, n);
    b->n += n;
    b->p[b->n] = 0;
}
static void jS(JBuf *b, const char *s) { jPut(b, s, strlen(s)); }
static void jI(JBuf *b, long long v) { char t[32]; int k = snprintf(t, sizeof t, "%lld", v); jPut(b, t, (size_t)k); }
static void jD(JBuf *b, double v) {
    if (!isfinite(v)) { jS(b, "null"); return; }
    char t[64]; int k = snprintf(t, sizeof t, "%.17g", v); jPut(b, t, (size_t)k);
}
static void jB(JBuf *b, bool v) { jS(b, v ? "true" : "false"); }
/* JSON 字符串；n < 0 时按 C 字符串算长度，s 是 NULL 写 null */
static void jQ(JBuf *b, const char *s, long n) {
    if (!s) { jS(b, "null"); return; }
    if (n < 0) n = (long)strlen(s);
    jS(b, "\"");
    for (long i = 0; i < n; i++) {
        unsigned char c = (unsigned char)s[i];
        if (c == '"' || c == '\\') { char t[2] = {'\\', (char)c}; jPut(b, t, 2); }
        else if (c == '\n') jS(b, "\\n");
        else if (c == '\r') jS(b, "\\r");
        else if (c == '\t') jS(b, "\\t");
        else if (c < 0x20) { char t[8]; snprintf(t, sizeof t, "\\u%04x", c); jS(b, t); }
        else jPut(b, (const char *)&s[i], 1);
    }
    jS(b, "\"");
}
static void jC(JBuf *b, char c) { jQ(b, &c, 1); }

/* 本用例建出的链表节点和最后一棵树（要按「是不是同一个节点」判的题用，见 judge/util.js） */
static struct ListNode **jNodes;
static int jNodeN, jNodeCap;
static struct TreeNode *jLastTree;
static const char *jFailMsg;
static void jReset(void) { jNodeN = 0; jLastTree = NULL; jFailMsg = NULL; }

static void *jAlloc(size_t n) { void *p = malloc(n ? n : 1); memset(p, 0, n ? n : 1); return p; }
static int *jInts(const int *v, int n) { int *p = (int *)jAlloc(sizeof(int) * (size_t)n); if (n) memcpy(p, v, sizeof(int) * (size_t)n); return p; }
static long long *jLongs(const long long *v, int n) { long long *p = (long long *)jAlloc(sizeof(long long) * (size_t)n); if (n) memcpy(p, v, sizeof(long long) * (size_t)n); return p; }
static double *jDbls(const double *v, int n) { double *p = (double *)jAlloc(sizeof(double) * (size_t)n); if (n) memcpy(p, v, sizeof(double) * (size_t)n); return p; }
static bool *jBools(const bool *v, int n) { bool *p = (bool *)jAlloc(sizeof(bool) * (size_t)n); if (n) memcpy(p, v, sizeof(bool) * (size_t)n); return p; }
static char *jStr(const char *s, int n) { char *p = (char *)jAlloc((size_t)n + 1); memcpy(p, s, (size_t)n); return p; }
static void **jRows(int n) { return (void **)jAlloc(sizeof(void *) * (size_t)n); }

static struct ListNode *jNew(int v) {
    struct ListNode *x = (struct ListNode *)jAlloc(sizeof *x);
    x->val = v;
    if (jNodeN == jNodeCap) { jNodeCap = jNodeCap ? jNodeCap * 2 : 64; jNodes = (struct ListNode **)realloc(jNodes, sizeof *jNodes * (size_t)jNodeCap); }
    jNodes[jNodeN++] = x;
    return x;
}
static struct ListNode *jList(const int *v, int n) {
    struct ListNode *h = NULL, *t = NULL;
    for (int i = 0; i < n; i++) { struct ListNode *x = jNew(v[i]); if (t) t->next = x; else h = x; t = x; }
    return h;
}
/* 最后一个节点接回下标 pos 的节点（-1 不成环） */
static struct ListNode *jCycle(const int *v, int n, int pos) {
    int s = jNodeN;
    struct ListNode *h = jList(v, n);
    if (pos >= 0 && n > 0) jNodes[s + n - 1]->next = jNodes[s + pos];
    return h;
}
/* 独有部分后面接上本用例建出的第 k 个节点（-1 不接） */
static struct ListNode *jJoin(const int *v, int n, int k) {
    struct ListNode *tail = k >= 0 ? jNodes[k] : NULL;
    int s = jNodeN;
    struct ListNode *h = jList(v, n);
    if (n == 0) return tail;
    jNodes[s + n - 1]->next = tail;
    return h;
}
static void jIndex(JBuf *b, struct ListNode *x) {
    if (!x) { jS(b, "null"); return; }
    for (int i = 0; i < jNodeN; i++) if (jNodes[i] == x) { jI(b, i); return; }
    jQ(b, "不是输入里的节点", -1);
}

#define JN LLONG_MIN
static struct TreeNode *jTNew(int v) { struct TreeNode *t = (struct TreeNode *)jAlloc(sizeof *t); t->val = v; return t; }
/* 层序数组，JN 表示空位 */
static struct TreeNode *jTree(const long long *v, int n) {
    jLastTree = NULL;
    if (n == 0 || v[0] == JN) return NULL;
    struct TreeNode **q = (struct TreeNode **)jAlloc(sizeof *q * (size_t)n);
    int qn = 0, i = 1;
    struct TreeNode *root = jTNew((int)v[0]);
    q[qn++] = root;
    for (int h = 0; i < n && h < qn; h++) {
        struct TreeNode *x = q[h];
        if (v[i] != JN) { x->left = jTNew((int)v[i]); q[qn++] = x->left; }
        i++;
        if (i < n) { if (v[i] != JN) { x->right = jTNew((int)v[i]); q[qn++] = x->right; } i++; }
    }
    free(q);
    jLastTree = root;
    return root;
}
static struct TreeNode *jFind(int v) {
    struct TreeNode **st = (struct TreeNode **)jAlloc(sizeof *st * 4096);
    int sn = 0, cap = 4096;
    struct TreeNode *hit = NULL;
    if (jLastTree) st[sn++] = jLastTree;
    while (sn) {
        struct TreeNode *t = st[--sn];
        if (t->val == v) { hit = t; break; }
        if (sn + 2 > cap) { cap *= 2; st = (struct TreeNode **)realloc(st, sizeof *st * (size_t)cap); }
        if (t->left) st[sn++] = t->left;
        if (t->right) st[sn++] = t->right;
    }
    free(st);
    return hit;
}
static void jTreeVal(JBuf *b, struct TreeNode *t) { if (!t) jS(b, "null"); else jI(b, t->val); }

static void jListOut(JBuf *b, struct ListNode *h) {
    jS(b, "[");
    int n = 0;
    for (struct ListNode *p = h; p && n < 100000; p = p->next, n++) { if (n) jS(b, ","); jI(b, p->val); }
    jS(b, "]");
}
static void jTreeOut(JBuf *b, struct TreeNode *t) {
    int cap = 1024, qn = 0;
    struct TreeNode **q = (struct TreeNode **)jAlloc(sizeof *q * (size_t)cap);
    q[qn++] = t;
    int last = -1;
    for (int h = 0; h < qn && qn < 400000; h++) {
        if (q[h]) {
            last = h;
            if (qn + 2 > cap) { cap *= 2; q = (struct TreeNode **)realloc(q, sizeof *q * (size_t)cap); }
            q[qn++] = q[h]->left;
            q[qn++] = q[h]->right;
        }
    }
    jS(b, "[");
    for (int h = 0; h <= last; h++) { if (h) jS(b, ","); if (q[h]) jI(b, q[h]->val); else jS(b, "null"); }
    jS(b, "]");
    free(q);
}
static void jIntsOut(JBuf *b, const int *v, int n) {
    if (n > 0 && !v) { jFailMsg = "返回了空指针，但 *returnSize 大于 0"; return; }
    jS(b, "[");
    for (int i = 0; i < n; i++) { if (i) jS(b, ","); jI(b, v[i]); }
    jS(b, "]");
}
static void jLongsOut(JBuf *b, const long long *v, int n) {
    jS(b, "[");
    for (int i = 0; i < n; i++) { if (i) jS(b, ","); jI(b, v[i]); }
    jS(b, "]");
}
static void jIntsOut2(JBuf *b, int **v, int n, const int *cols) {
    if (n > 0 && !v) { jFailMsg = "返回了空指针，但 *returnSize 大于 0"; return; }
    if (n > 0 && !cols) { jFailMsg = "没有设置 *returnColumnSizes（每一行的长度）"; return; }
    jS(b, "[");
    for (int i = 0; i < n; i++) { if (i) jS(b, ","); jIntsOut(b, v[i], cols[i]); }
    jS(b, "]");
}
static void jStrsOut(JBuf *b, char **v, int n) {
    if (n > 0 && !v) { jFailMsg = "返回了空指针，但 *returnSize 大于 0"; return; }
    jS(b, "[");
    for (int i = 0; i < n; i++) { if (i) jS(b, ","); jQ(b, v[i], -1); }
    jS(b, "]");
}
static void jStrsOut2(JBuf *b, char ***v, int n, const int *cols) {
    if (n > 0 && !v) { jFailMsg = "返回了空指针，但 *returnSize 大于 0"; return; }
    if (n > 0 && !cols) { jFailMsg = "没有设置 *returnColumnSizes（每一行的长度）"; return; }
    jS(b, "[");
    for (int i = 0; i < n; i++) { if (i) jS(b, ","); jStrsOut(b, v[i], cols[i]); }
    jS(b, "]");
}
static void jCharsOut2(JBuf *b, char **v, int n, const int *cols) {
    jS(b, "[");
    for (int i = 0; i < n; i++) {
        if (i) jS(b, ",");
        jS(b, "[");
        for (int j = 0; j < cols[i]; j++) { if (j) jS(b, ","); jC(b, v[i][j]); }
        jS(b, "]");
    }
    jS(b, "]");
}

/* 分隔标记（见 tools/runner/sandbox/programs.js） */
static const char *jTok = "";
static int jCur;
static void jMark(const char *s) {
    fflush(stdout);
    JBuf m = {0};
    jS(&m, "\001");
    jS(&m, jTok);
    jS(&m, ":");
    jS(&m, s);
    jS(&m, "\002");
    size_t w = 0;
    while (w < m.n) { ssize_t r = write(1, m.p + w, m.n - w); if (r <= 0) break; w += (size_t)r; }
    free(m.p);
}
static void jEmit(JBuf *b) {
    char h[32];
    snprintf(h, sizeof h, "R:%d:", jCur);
    JBuf m = {0};
    jS(&m, h);
    if (jFailMsg) { jS(&m, "{\"__error\":"); jQ(&m, jFailMsg, -1); jS(&m, "}"); }
    else if (b->p) jPut(&m, b->p, b->n);
    else jS(&m, "null");
    jMark(m.p);
    free(m.p);
    free(b->p);
    b->p = NULL; b->n = b->cap = 0;
}
