.PHONY: all
all: dist/index.js

venv: Makefile
	rm -rf venv
	virtualenv venv -ppython3
	venv/bin/pip install markdown-to-presentation

node_modules: package.json
	yarn install --silent
	test -d node_modules
	touch node_modules

dist/index.js: src/index.ts node_modules webpack.config.ts
	$(shell yarn bin webpack) --config webpack.config.ts

.PHONY: push
push: venv
	venv/bin/markdown-to-presentation push \
		--pages-branch release \
		README.md LICENSE action.yml dist/index.js patch/
