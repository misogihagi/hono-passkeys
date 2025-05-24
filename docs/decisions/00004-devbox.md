# 開発環境にJetify Devboxを使う

## はじめに

* [決定](#決定)
* [ステータス](#ステータス)
* [背景](#背景)
* [想定される影響](#想定される影響)
* [検討した他の選択肢](#検討した他の選択肢)
* [参考文献](#参考文献)
* [結果](#結果)

## 決定

開発環境にJetify Devboxを使う

## ステータス

<!-- to render SVG file trick -->
<!-- markdownlint-disable MD013 MD033 MD013 -->
### <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/refs/heads/6.x/svgs/regular/circle-check.svg" width="10" alt="承認済み" /> 承認済み

## 背景

Dockerやasdf、Nixなどこの手のツールはいろいろあるが、一番いいのはこれ。
参考文献を参照。

jetify devboxを採用する利点。

* **Nixのパワーと簡便性:** Nixの強力なパッケージ管理システムを基盤としつつ、よりユーザーフレンドリーなインターフェースを提供する。複雑なNixの構文を意識することなく、直感的な設定ファイルで開発環境を構築できる。
* **宣言的な設定:** `devbox.json`ファイルにプロジェクトに必要なツールやパッケージを記述するだけで、環境が自動的に構築される。これにより、チームメンバー間で一貫した開発環境を簡単に共有・再現できる。
* **幅広い言語とツールのサポート:** Python、Node.js、Go、Rubyなど、多くのプログラミング言語やデータベース、CLIツールなどをサポートしている。
* **高速な環境構築:** Nixのキャッシュ機能により、依存関係のダウンロードやビルドを効率的に行い、高速な環境構築を実現できる。
* **ポータブルな開発環境:** devboxで構築した環境は、異なるOSや環境間でも比較的容易に移行できる。

jetify devboxで考慮すべき点。

* **比較的新しいツール:** 他の成熟したツールに比べると、コミュニティの規模や利用実績はまだ小さい。
* **Nixの概念の理解:** Nixの基本的な概念を理解しておく必要がある。

## 想定される影響

## 検討した他の選択肢

以下参考文献より引用

### 視野の広がり：asdf/miseの時代

これらの課題を解決するため、より包括的なバージョン管理ツールである[asdf](https://asdf-vm.com)を導入しました。asdfは多言語対応の統合的なバージョン管理が可能で、プラグインエコシステムにより高い拡張性を持っていました。

その後、コマンドがより直感的なmiseに移行しました。miseはasdfのプラグインエコシステムを活かしながら、より使いやすいインターフェースを提供してくれました。

asdf/miseによって、チーム全体での環境統一が容易になりました。しかし、新たな課題もまた見えてきます。

### パッケージ管理の新たな課題

asdf/miseは優れたツールでしたが、完璧ではありませんでした。必要なパッケージが提供されていないケースが少なからずあり、その場合はプラグインを自作する必要がありました。これは予想以上に手間のかかる作業でした。

さらに状況が変わったのは、プロジェクトがモノレポ化を進めることになった時です。[moon](https://moonrepo.dev)とそのパッケージ管理ツールである[proto](https://moonrepo.dev/docs/proto)を導入しました。

```bash
proto install node lts --pin
```

protoは確かにmoonと深く統合されており、必要なツールを自動的に揃えてくれる便利な機能がありました。しかし、ここでも同じ課題に直面します。必要なツールのパッケージが不足しており、[インストーラーを自作](https://github.com/appthrust/proto-toml-plugins)する必要がありました。さらに、Pythonに依存する[yamllint](https://github.com/adrienverge/yamllint)のような複雑な依存関係を持つツールのパッケージ化は、工数の観点から現実的ではありませんでした。

### Nixとの出会い：強力だが急峻な学習曲線

次に試した[Nix](https://nixos.org)は、それまでのツールとは一線を画す存在でした。パッケージの豊富さは群を抜いており、yamllintのような複雑な依存関係を持つツールでも、依存関係を含めて簡単に導入できました。長年抱えていた「パッケージが足りない」という課題が、ほぼ完全に解決されたのです。

```nix:flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        tools = with pkgs; [
          nodejs_22
          jq
          direnv
          yamllint
        ];
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = tools;
          shellHook = ''
          '';
        };
      }
    );
}

```

Nixは豊富なパッケージ群を持ち、完全な依存関係の解決と環境の完全な再現性を提供してくれました。しかし、新たな課題もありました。それは言語自体の学習コストの高さです。他のツールではtomlなどで必要なツールをリストアップするだけで良かったのに対し、Nixにはそのシンプルさがありません。また、特定のバージョンを導入したい場合も、nixpkgsのコミットハッシュを指定するなど、やや回りくどい作業が必要でした。

### devboxとの出会い：シンプルさへの回帰

最近[devbox](https://www.jetify.com/devbox)というツールを見つけました。devboxは、Nixの強力な基盤を活かしながら、シンプルなインターフェースを提供してくれます。

npmやhomebrewを使ったことがある人なら、5分で使い始められるほど学習コストが低いのです。裏でNixが動いているため、Nixの持つ膨大なパッケージを利用できる一方で、複雑な設定や概念を意識する必要がありません。

```bash
devbox init
devbox add nodejs@22 jq direnv yamllint
devbox shell
```

シンプルな設定と豊富なパッケージ、低い学習コストに加えて、DockerfileやGithub Actions、direnvの.envrcとの連携など、既存の開発フローとの親和性も高いです。個人プロジェクトで使ってみてかなり良さそうという印象でした。まだチームプロジェクトには導入していませんが、チームでの採用も期待感が持てるツールだという感想です。


## 参考文献

https://qiita.com/suin/items/3ec298a4172fdf6f60b6

## 結果
