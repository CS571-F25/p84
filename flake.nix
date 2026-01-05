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
        pkgs = import nixpkgs { inherit system; };
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
