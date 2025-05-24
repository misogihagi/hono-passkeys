# ADRテンプレートツールにadrowseを使う

## はじめに

* [決定](#決定)
* [ステータス](#ステータス)
* [背景](#背景)
* [想定される影響](#想定される影響)
* [検討した他の選択肢](#検討した他の選択肢)
* [参考文献](#参考文献)
* [結果](#結果)

## 決定

ADRテンプレートツールにadrowseを使う。

## ステータス

<!-- to render SVG file trick -->
<!-- markdownlint-disable MD013 MD033 MD013 -->
### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/refs/heads/6.x/svgs/regular/circle-check.svg" width="10" alt="承認済み" /> 承認済み

## 背景

この手のツールは他にもあるが、これが一番良い。

## 想定される影響

## 検討した他の選択肢

こういったツールは、

* adr-tools
* adr-log
* pyadr

他にもあるが、どれもとっても、

* クロスプラットフォームじゃない
* JavaScriptやPythonなどの環境が必要
* テンプレート選べない
* **日本語に対応していない**

という問題がある。

その点adrowseは日本語にも対応しているし、ランタイムを必要とせずクロスプラットフォーム。

## 参考文献

## 結果
