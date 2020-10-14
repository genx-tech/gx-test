const targetLTSVersion = "12.0";

module.exports = function (api) {  
  let isProduction = api.env(["production"]); 

  return {
    "sourceMaps": "both",
    "presets": [
      [
        "@babel/env",
        {      
          "targets": {     
            "node": targetLTSVersion
          },
          "exclude": [ "@babel/plugin-transform-regenerator" ]
        }
      ]
    ],
    "comments": false,
    "ignore": [
      "node_modules"
    ], 
    "plugins": [
      ["contract", {
        "strip": isProduction,
        "names": {
          "assert": "assert",
          "precondition": "pre",
          "postcondition": "post",
          "invariant": "invariant",
          "return": "it"
        }
      }],      
      ["@babel/plugin-proposal-decorators", {"legacy": true}],
      ["@babel/plugin-proposal-class-properties", { "loose": true }],
      "@babel/plugin-proposal-nullish-coalescing-operator",
      "@babel/plugin-proposal-optional-chaining",
      "@babel/plugin-proposal-logical-assignment-operators",
      ["@babel/plugin-proposal-pipeline-operator", { "proposal": "minimal" }],
      "source-map-support"
    ]
  };
}