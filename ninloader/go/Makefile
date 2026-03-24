BINARY := ninloader
VERSION := 1.0.0
LDFLAGS := -ldflags "-s -w -X main.Version=$(VERSION)"

TARGETS := \
	darwin/amd64 \
	darwin/arm64 \
	linux/amd64 \
	linux/arm64 \
	windows/amd64

.PHONY: all clean test dev vet

all: $(foreach T,$(TARGETS),dist/$(subst /,_,$(T))/$(BINARY)$(if $(findstring windows,$(T)),.exe,))

dist/darwin_amd64/$(BINARY): $(wildcard *.go **/*.go)
	@mkdir -p $(@D)
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build $(LDFLAGS) -o $@ .

dist/darwin_arm64/$(BINARY): $(wildcard *.go **/*.go)
	@mkdir -p $(@D)
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build $(LDFLAGS) -o $@ .

dist/linux_amd64/$(BINARY): $(wildcard *.go **/*.go)
	@mkdir -p $(@D)
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(LDFLAGS) -o $@ .

dist/linux_arm64/$(BINARY): $(wildcard *.go **/*.go)
	@mkdir -p $(@D)
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build $(LDFLAGS) -o $@ .

dist/windows_amd64/$(BINARY).exe: $(wildcard *.go **/*.go)
	@mkdir -p $(@D)
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build $(LDFLAGS) -o $@ .

# macOS universal binary (amd64 + arm64 lipo merged)
dist/macos_universal/$(BINARY): dist/darwin_amd64/$(BINARY) dist/darwin_arm64/$(BINARY)
	@mkdir -p $(@D)
	lipo -create -output $@ $^

clean:
	rm -rf dist/ $(BINARY)

test:
	go test ./...

vet:
	go vet ./...

# Single-platform build for development
dev:
	CGO_ENABLED=0 go build $(LDFLAGS) -o $(BINARY) .
