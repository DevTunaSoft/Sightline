using Sightline.Core;
using Xunit;

namespace Sightline.Core.Tests;

public sealed class ArchitectureTests
{
    [Fact]
    public void Core_has_no_FlaUI_or_Windows_implementation_dependency()
    {
        var references = typeof(IDesktopObserver).Assembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.DoesNotContain(references, name =>
            name.StartsWith("FlaUI", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(references, name =>
            string.Equals(name, "Sightline.Windows", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Core_has_no_browser_or_model_runtime_dependency()
    {
        var references = typeof(IDesktopObserver).Assembly
            .GetReferencedAssemblies()
            .Select(reference => reference.Name ?? string.Empty)
            .ToArray();

        Assert.DoesNotContain(references, name =>
            name.Contains("Ollama", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Llama", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("Playwright", StringComparison.OrdinalIgnoreCase));
    }
}
