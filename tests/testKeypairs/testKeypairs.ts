import { Keypair } from '@solana/web3.js'

export const userKeypair1 = Keypair.fromSecretKey(Uint8Array.from([
    53,  28,  80, 252,  93, 162, 153, 218, 121,  66, 246,
    205, 160, 209, 195, 164,   3,  12,  58,  65, 129,  16,
    78,  50, 207, 154, 113, 216, 230,  12, 100, 113, 185,
    55,  56, 218,   9, 148, 214, 149,  68, 154, 124,  84,
    214,  51,  99, 139, 196, 137, 214, 230,   1,  32,  82,
    138,  65, 209,  63,  77, 138,  97, 131,  98
]))

export const userKeypair2 = Keypair.fromSecretKey(Uint8Array.from([
    169, 107,  14,  42, 217, 155,  70, 192, 165, 169, 130,
    233, 111, 184, 121,  24,  76, 103, 204,  15, 177, 157,
    181,  34, 137,  67,  55, 130, 104,  79, 144, 108,   1,
    33, 176,  13, 117,   6,  12,  73, 126, 158, 143, 150,
    254, 199, 117,   4, 160, 132, 174,  71, 110,  56,   3,
    202, 127, 174, 104, 104, 146,  93,  73, 231
]))

export const userKeypair3 = Keypair.fromSecretKey(Uint8Array.from([
    41,   9,   1,  33, 194, 227, 140,  20, 145, 118, 135,
    169,  40, 111,  30, 136, 113,  97,  45, 231,  90, 136,
    201, 112, 156, 171,  30,  85, 241, 109, 145, 140, 222,
    55, 227, 171,   0, 122,  70,  49, 177,  30,  96, 234,
    76, 148, 102, 233,  36,   3, 221, 184, 240,  87, 246,
    216,  20, 232, 186, 180, 229, 177,  64,   3
]))

export const programAuthority = Keypair.fromSecretKey(Uint8Array.from([
    19, 253,  88,   8,  27,  78,  90,  26, 172, 115, 202,
    3,   4,   2,  14, 253, 109, 148, 190,  54, 120, 196,
    39,  85, 108, 224,  68, 140, 209, 107,  86, 105, 124,
    21,  45,  88,  25, 205, 217,  64, 238, 193, 135, 114,
    38,   7,  11,  66, 220, 158, 192,  30, 219,  31, 243,
    18, 160,  29,  95, 177, 209, 129,  68,  60
]))

export const incorrectProgramAuthority = Keypair.fromSecretKey(Uint8Array.from(
    [
        236, 171, 153, 235,  14, 211, 175, 198, 217,  87, 130,
        167,  21, 126, 154,  99, 246,  16, 251, 106, 211, 117,
        92,  44, 200,  23, 111,   6, 232, 157, 118, 251,  60,
        83,  89, 172, 194, 147,  16, 177, 106,  31, 182,  19,
        218, 250, 187,  45, 217, 194,  89, 176,  97, 116,  17,
        94, 217,  25, 142, 246, 216, 192, 196,  11
]))