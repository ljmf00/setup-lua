import { resolve } from 'path';
import TerserPlugin = require("terser-webpack-plugin");

module.exports = {
    entry: './src/index.ts',
    target: 'node',
    devtool: 'source-map',
    mode: 'production',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
      filename: 'index.js',
      path: resolve(__dirname, 'dist'),
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    mangle: false,
                    sourceMap: true,
                    compress: false,
                    keep_classnames: true,
                    keep_fnames: true,
                    output: {
                        comments: false,
                    },
                }
            }),
        ],
      },
};
