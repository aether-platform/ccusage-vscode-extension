const path = require('path');

module.exports = {
  target: 'node',
  mode: 'none',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /refs/],
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                sourceMap: true
              }
            }
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  infrastructureLogging: {
    level: "log",
  },
};