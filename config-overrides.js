const {
    override,
    addLessLoader,
    disableChunk,
    addBabelPlugins,
    removeModuleScopePlugin,
    addBabelPresets
  } = require("customize-cra");
  
module.exports =override(
    // do stuff with the webpack config...
    addLessLoader({
            javascriptEnabled: true,
            importLoaders: true,
            modifyVars: {}
    }),
);