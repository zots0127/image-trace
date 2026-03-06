# Image Trace — Test Coverage Report

Generated: 2026-03-06

## Summary

| Metric | Value |
|:---|:---|
| **Total Tests** | 220 |
| **Test Files** | 7 |
| **Status** | ✅ All passing |

## Test Files

| File | Tests | Covers |
|:---|:---|:---|
| `test_api.py` | 29 | CRUD endpoints: projects, upload, images, compare |
| `test_image_processor.py` | 62 | Hash computation, similarity, descriptors, grouping, caching |
| `test_utils.py` | 54 | DB utils, file ops, format support, unique filenames, grouping |
| `test_new_algorithms.py` | 45 | SSIM, Histogram, Template, AKAZE/KAZE, Colorhash, Hybrid fusion |
| `test_document_parser.py` | 18 | PDF extraction, Office docs, format detection, path conversion |
| `test_pairwise_and_viz.py` | 31 | Pairwise matrix, visualize_match, rotation API, DB migration, thumbnail, match_data |
| `test_report_and_endpoints.py` | 25 | /report, /analysis_runs, GET /results, /download, resize, orientation, file cleanup |

## Coverage by Module

### main.py (API Endpoints)
| Endpoint | Tested In |
|:---|:---|
| `GET /` | test_api |
| `GET /health` | test_api |
| `POST /projects` | test_api |
| `GET /projects` | test_api |
| `GET /projects/{id}` | test_api |
| `DELETE /projects/{id}` | test_api |
| `POST /upload` | test_api (png, tif, jpg, unsupported, nonexistent project) |
| `POST /compare/{id}` | test_api, test_pairwise_and_viz |
| `GET /results/{id}` | test_report_and_endpoints |
| `GET /analysis_runs` | test_report_and_endpoints |
| `GET /analysis_runs/{id}` | test_report_and_endpoints |
| `GET /images/{project_id}` | test_api |
| `DELETE /images/{id}` | test_api |
| `GET /download` | test_report_and_endpoints |
| `POST /visualize_match` | test_pairwise_and_viz |
| `GET /pairwise_matrix/{id}` | test_pairwise_and_viz |
| `GET /thumbnail/{id}` | test_pairwise_and_viz |
| `POST /match_data` | test_pairwise_and_viz |
| `GET /report/{id}` | test_report_and_endpoints |

### image_processor.py
| Function | Tested In |
|:---|:---|
| `compute_file_md5` | test_image_processor |
| `compute_image_features` | test_image_processor |
| `hamming_distance` | test_image_processor |
| `calculate_similarity` | test_image_processor |
| `compute_descriptor` (ORB/BRISK/SIFT/AKAZE/KAZE) | test_image_processor, test_new_algorithms |
| `calculate_descriptor_similarity` | test_image_processor |
| `get_cached_descriptor` | test_image_processor |
| `draw_feature_matches` | test_image_processor |
| `find_similar_images` | test_image_processor |
| `group_similar_images` | test_image_processor |
| `is_image_file` | test_image_processor |
| `resize_image_if_needed` | test_report_and_endpoints |
| `calculate_ssim_similarity` | test_new_algorithms |
| `calculate_histogram_similarity` | test_new_algorithms |
| `calculate_template_similarity` | test_new_algorithms |
| `calculate_hybrid_similarity` | test_new_algorithms |
| `_generate_orientation_variants` | test_report_and_endpoints |
| `compute_features_for_variants` | test_report_and_endpoints |
| `compare_with_orientations` | test_report_and_endpoints |

### utils.py
| Function | Tested In |
|:---|:---|
| `get_database_url` | test_utils |
| `get_session` | test_utils |
| `ensure_directory` | test_utils |
| `generate_unique_filename` | test_utils |
| `save_upload_file` | test_utils |
| `get_file_size_mb` | test_utils |
| `format_file_size` | test_utils |
| `is_supported_image_format` | test_utils, test_report_and_endpoints |
| `is_supported_document_format` | test_utils |
| `delete_file_if_exists` | test_report_and_endpoints |
| `group_similar_by_metric` | test_utils |
| `compare_images_in_project` | test_utils |

### document_parser.py
| Function | Tested In |
|:---|:---|
| `DocumentParser.__init__` | test_document_parser |
| `_guess_image_extension` | test_document_parser (PNG, JPEG, GIF, BMP, TIFF, unknown) |
| `process_document` | test_document_parser (with/without image, unsupported, nonexistent) |
| `extract_images_from_document` | test_document_parser |
| `_rel_to_base` | test_document_parser |
