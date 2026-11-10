using FlaUI.UIA3;

namespace Sightline.Windows;

public sealed record UiaRuntimeOptions(
    TimeSpan ConnectionTimeout,
    TimeSpan TransactionTimeout)
{
    public static UiaRuntimeOptions Default { get; } =
        new(TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(10));

    public void Validate()
    {
        if (ConnectionTimeout < TimeSpan.FromMilliseconds(250) ||
            ConnectionTimeout > TimeSpan.FromSeconds(30))
            throw new ArgumentOutOfRangeException(nameof(ConnectionTimeout));

        if (TransactionTimeout < TimeSpan.FromMilliseconds(500) ||
            TransactionTimeout > TimeSpan.FromSeconds(60))
            throw new ArgumentOutOfRangeException(nameof(TransactionTimeout));
    }
}

internal static class FlaUiAutomationFactory
{
    public static UIA3Automation Create(UiaRuntimeOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        options.Validate();

        var automation = new UIA3Automation
        {
            ConnectionTimeout = options.ConnectionTimeout,
            TransactionTimeout = options.TransactionTimeout,
        };
        return automation;
    }
}
