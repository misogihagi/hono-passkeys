## はじめに

- [決定](#決定)
- [ステータス](#ステータス)
- [背景](#背景)
- [想定される影響](#想定される影響)
- [検討した他の選択肢](#検討した他の選択肢)
- [参考文献](#参考文献)
- [結果](#結果)

## 決定

VSCode による統合を行う。

[開発環境に Jetify Devbox を使う](./00004-devbox.md)
[EditorConfig を導入する](./00005-editorconfig.md)
[タイポミスをなくすため CSpell と typos を導入する](./00006-zero-typo.md)
も参照。

## ステータス

### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/refs/heads/6.x/svgs/regular/circle-check.svg" width="10" alt="承認済み" /> 承認済み

## 背景

タイポミスを減らすためツールは導入した。
さらに開発体験を良くするため、VSCode との統合を行う。
また、Devbox 用の拡張機能も用意されているので、それも導入する。
具体的には拡張機能の選定と設定を決める。
なお、typos に関しては VSCode の拡張機能はない。
参照：https://github.com/crate-ci/typos/issues/263

## 想定される影響

## 検討した他の選択肢

Vim や emacs は使ってないので…

## 参考文献

## 結果
