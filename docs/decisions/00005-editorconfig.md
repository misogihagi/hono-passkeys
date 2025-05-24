# EditorConfigを導入する

## はじめに

* [決定](#決定)
* [ステータス](#ステータス)
* [背景](#背景)
* [想定される影響](#想定される影響)
* [検討した他の選択肢](#検討した他の選択肢)
* [参考文献](#参考文献)
* [結果](#結果)

## 決定

EditorConfigを導入する。

有効にした設定は以下の通り。

```text
root = true

[*]
# WindowsでShift-jisになることがあるのでUTF8で統一
charset = utf-8
# 改行がまちまちになるとgitで差分が出るのでUnixスタイルで統一
end_of_line = lf
# Gitの差分に影響を与えるので最終行には改行を入れる
# https://qiita.com/hamacccccchan/items/11c17c7412a5aeb2ad74
insert_final_newline = true
# これもまた差分が出る
trim_trailing_whitespace = true
```

## ステータス

<!-- to render SVG file trick -->
<!-- markdownlint-disable MD013 MD033 MD013 -->
### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/refs/heads/6.x/svgs/regular/circle-check.svg" width="10" alt="承認済み" /> 承認済み

## 背景

EditorConfigは、例えPrettierがあったとしても、

* インデントの種類や文字コードといった、より基本的なエディタの設定を扱う。
* JavaScript、CSS、HTMLなどのコードフォーマットにとらわれない。
* より広範なファイルタイプ（Markdown、設定ファイル、テキストファイルなど）に対して設定を適用できる。

といった利点がある。

そして、EditorConfigファイル（.editorconfig）をリポジトリに含めることで、プロジェクトに参加するすべての開発者が自動的に同じエディタ設定を共有できる。これにより、「タブとスペースどっちを使うのか」のような議論を避けることができる。

さらに、Gitにおいては以下のような良いことがある。

1. 行末の自動修正による不要な差分の削減:

    異なるOSやエディタでは、改行コードがCRLF (\r\n)、LF (\n)、CR (\r)と異なる場合がある。
    EditorConfigでend_of_lineを設定することで、リポジトリ内で使用する改行コードを統一できる。
    これにより、単に改行コードが異なるだけの不要な差分がGitの履歴に残るのを防ぎ、変更内容の本質がより明確になる。
    コードレビューの際にも、変更された意義のある部分に、集中できるようになる。

2. 空白文字に関する不要な差分の削減:

    行末の空白や、不要なインデントの空白なども、エディタの設定によって意図せずコミットされてしまうことがある。
    EditorConfigのtrim_trailing_whitespaceやinsert_final_newlineを設定することで、これらの不要な空白を自動的に削除したり、ファイルの末尾に改行を挿入したりできる。
    これにより、空白文字だけの変更といった無意味な差分がGitの履歴に残るのを防ぎ、履歴をきれいに保てる。

## 想定される影響

## 検討した他の選択肢

EditorConfigにあたるものは探してもなかった。

## 参考文献

## 結果
