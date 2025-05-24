# 最初のコミットは空コミットにする

## はじめに

* [決定](#決定)
* [ステータス](#ステータス)
* [背景](#背景)
* [想定される影響](#想定される影響)
* [検討した他の選択肢](#検討した他の選択肢)
* [参考文献](#参考文献)
* [結果](#結果)

## 決定

最初のコミットは空コミットにする。

## ステータス

<!-- to render SVG file trick -->
<!-- markdownlint-disable MD013 MD033 MD013 -->
### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/refs/heads/6.x/svgs/regular/circle-check.svg" width="10" alt="承認済み" /> 承認済み

## 背景

最初に空のコミットを作っておくとgit rebaseやマージが楽になる。

### ユースケース

feature-xブランチとfeature-yブランチがあり、これらのブランチは共通の祖先コミットを持っている。
通常、このようなブランチを git merge しようとすると、Git は共通の履歴を見つけられないため、マージを拒否するか、複雑な履歴になってしまう。

しかし、feature-x ブランチの最初のコミットを空にしておくことで、
main ブランチに feature-x ブランチの全履歴とfeature-y ブランチの全履歴を新しい変更として取り込むことができる。

## 想定される影響

## 検討した他の選択肢

## 参考文献

<https://qiita.com/NorsteinBekkler/items/b2418cd5e14a52189d19>

## 結果
