package registry

import "github.com/ninken/ninloader-go/internal/collector"

// registry maps (service, source) to a Collector factory function.
var reg = map[[2]string]func() collector.Collector{}

// Register adds a collector factory to the registry.
// Called from each collector package's init() function.
func Register(service, source string, factory func() collector.Collector) {
	reg[[2]string{service, source}] = factory
}

// Get returns a new Collector instance for the given service/source.
// Returns nil if not found.
func Get(service, source string) collector.Collector {
	f, ok := reg[[2]string{service, source}]
	if !ok {
		return nil
	}
	return f()
}

// All returns a new instance of every registered collector.
func All() []collector.Collector {
	result := make([]collector.Collector, 0, len(reg))
	for _, f := range reg {
		result = append(result, f())
	}
	return result
}

// AllForService returns new instances of all collectors for a given service.
func AllForService(service string) []collector.Collector {
	var result []collector.Collector
	for key, f := range reg {
		if key[0] == service {
			result = append(result, f())
		}
	}
	return result
}
