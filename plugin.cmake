# add_standard_plugin_tests()

add_python_style_test(
  python_static_analysis_overlays_tests
  "${PROJECT_SOURCE_DIR}/plugins/overlays/plugin_tests"
)
add_python_test(overlays
  PLUGIN overlays
)
add_web_client_test(
  panel_test
  "${CMAKE_CURRENT_LIST_DIR}/plugin_tests/panelSpec.js"
  PLUGIN overlays
)

add_web_client_test(
  save_overlay_test
  "${CMAKE_CURRENT_LIST_DIR}/plugin_tests/saveOverlaySpec.js"
  PLUGIN overlays
)

add_web_client_test(
  imageView_test
  "${CMAKE_CURRENT_LIST_DIR}/plugin_tests/imageViewSpec.js"
  PLUGIN overlays
  TEST_MODULE "plugin_tests.web_client_test"
  TEST_PYTHONPATH "${CMAKE_CURRENT_LIST_DIR}"
  EXTERNAL_DATA "plugins/overlays/Segmentation.tiff"
)

add_eslint_test(
  js_static_analysis_overlays_tests "${PROJECT_SOURCE_DIR}/plugins/overlays"
)