module.exports = {
    "env": {
        "browser": true,
        "es6": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "p5js",
        "p5js/dom",
        "p5js/sound",
        "prettier"
    ],
    "plugins": ["prettier"],
    "parserOptions": {
        "sourceType": "module"
    },
    "rules": {
        "prettier/prettier": [
          "error",
          {
            "singleQuote": true
          }
        ],
        "indent": [
            "error",
            2
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};