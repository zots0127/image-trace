# TestCoverage — Image Trace Backend

> 最后更新: 2026-03-06

## 运行方式

```bash
cd backend_simplified
source venv/bin/activate
pip install pytest pytest-cov httpx numpy scikit-image

# 运行全部测试 + 覆盖率
python -m pytest tests/ -v --cov=app --cov-report=term-missing
```

## 覆盖率概览

| 模块 | 语句 | 未覆盖 | 覆盖率 |
|:---|---:|---:|---:|
| `models.py` | 62 | 0 | **100%** |
| `image_processor.py` | 302 | 45 | **85%** |
| `utils.py` | 193 | 52 | **73%** |
| `document_parser.py` | 157 | 60 | **62%** |
| `main.py` | 271 | 123 | **55%** |
| **合计** | **985** | **280** | **72%** |

## 测试文件对照

| 测试文件 | 覆盖模块 | 测试数 |
|:---|:---|---:|
| `tests/test_image_processor.py` | `image_processor.py` — 哈希/分组/resize/缓存/可视化/错误分支/格式 | 47 |
| `tests/test_new_algorithms.py` | `image_processor.py` — SSIM/直方图/模板/AKAZE/KAZE/colorhash/fusion | 20 |
| `tests/test_utils.py` | `utils.py` — 格式/目录/DB/分组/文件删除/清理 | 38 |
| `tests/test_document_parser.py` | `document_parser.py` | 13 |
| `tests/test_api.py` | `main.py` (API 集成) | 19 |
| `tests/conftest.py` | 共享 fixtures | — |
| **合计** | | **159** |

## 支持的图像格式（55 种扩展名）

| 类别 | 扩展名 |
|:---|:---|
| 常用 | jpg, jpeg, jfif, jpe, png, apng, gif, bmp, dib, tif, tiff, webp |
| JPEG 2000 | jp2, j2k, j2c, jpf, jpx, jpc |
| 专业 | psd, eps, ps, svg |
| 图标 | ico, cur, icns |
| Targa | tga, vda, icb, vst |
| 科学 | fits, fit, fts |
| 传统 | pcx, dcx, dds, qoi, mpo |
| NetPBM | pbm, pgm, ppm, pnm |
| SGI | sgi, rgb, rgba, bw |
| Sun/X | ras, flc, fli, xbm, xpm |
| RAW 相机 | cr2, cr3, nef, arw, dng, orf, rw2, raf |
| 新一代 | heic, heif, avif |

## 支持的比对算法

| 层级 | 算法 | 说明 |
|:---|:---|:---|
| **Tier 1** 哈希 | phash, dhash, ahash, whash, colorhash | 毫秒级，大规模初筛 |
| **Tier 2** 像素 | ssim, histogram, template | 百毫秒级，精细场景 |
| **Tier 3** 特征 | orb, sift, brisk, akaze, kaze | 秒级，几何变换场景 |
| **融合** | auto | pHash(0.3) + SSIM(0.3) + ORB(0.4) 加权 |
