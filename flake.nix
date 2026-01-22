{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (final: prev: {
              atproto-goat = prev.atproto-goat.overrideAttrs (old: {
                # Patch vendored indigo to remove large-string lint warning
                # (we intentionally use large strings for long-form richtext content)
                preBuild =
                  (old.preBuild or "")
                  + ''
                    if [ -d vendor ]; then
                      chmod -R u+w vendor
                      lintFile=vendor/github.com/bluesky-social/indigo/lex/lexlint/lint.go
                      # Verify the pattern exists before patching
                      grep -q 'large-string' "$lintFile" || (echo "ERROR: large-string check not found in lint.go - pattern may have changed" && exit 1)
                      # Remove the large-string check
                      sed -i '/if v.MaxLength != nil && \*v.MaxLength > 20\*1024/,/^[[:space:]]*}$/d' "$lintFile"
                      # Verify it was removed
                      ! grep -q 'large-string' "$lintFile" || (echo "ERROR: failed to remove large-string check" && exit 1)
                    fi
                  '';
              });
            })
          ];
        };
      in
      {
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              nodejs_22
              typescript
              just
              jq
              atproto-goat
              cacert # CA certificates for TLS verification
              # language servers
              typescript-language-server
              typespec
              # playwright browser for screenshot scripts
              playwright-driver.browsers
            ];
            shellHook = ''
              export PLAYWRIGHT_BROWSERS_PATH=${playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
            '';
          };
      }
    );
}
