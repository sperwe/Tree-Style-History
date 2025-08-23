const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');
const { config } = require('./package.json');

module.exports = (env) => {
  const isDev = env.development;
  const isProduction = env.production;

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      index: './src/index.ts',
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'build'),
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: 'manifest.json',
            to: 'manifest.json',
          },
          {
            from: 'addon/**/*',
            to: '[path][name][ext]',
          },
          {
            from: 'chrome/**/*',
            to: '[path][name][ext]',
          },
          {
            from: '_locales/**/*',
            to: '[path][name][ext]',
          },
        ],
      }),
      new ReplaceInFileWebpackPlugin([
        {
          dir: 'build',
          files: ['manifest.json'],
          rules: [
            {
              search: /__MSG_(\w+)__/g,
              replace: (match, key) => {
                return config[key] || match;
              },
            },
            {
              search: /YOUR_USERNAME/g,
              replace: 'your-github-username',
            },
            {
              search: /YOUR_NAME/g,
              replace: 'Your Name',
            },
          ],
        },
      ]),
    ],
    devtool: isDev ? 'source-map' : false,
    optimization: {
      minimize: isProduction,
    },
  };
};