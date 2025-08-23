const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const { config } = require('./package.json');

module.exports = (env = {}) => {
  const isDev = env.development;
  const isProduction = env.production;

  return {
    mode: isProduction ? 'production' : 'development',
    entry: {
      index: './src/simple-index.js',
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
            from: 'addon/',
            to: './',
          },
          {
            from: '_locales/',
            to: '_locales/',
          },
          {
            from: 'manifest.json',
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content.toString());
              // 替换占位符
              manifest.name = config.addonName || manifest.name;
              manifest.description = `A Zotero plugin for tracking research history and enhanced note navigation`;
              manifest.author = 'Research Navigator Developer';
              manifest.homepage_url = 'https://github.com/your-username/zotero-research-navigator';
              
              return JSON.stringify(manifest, null, 2);
            },
          },
        ],
      }),
    ],
    devtool: isDev ? 'source-map' : false,
    optimization: {
      minimize: isProduction,
    },
  };
};