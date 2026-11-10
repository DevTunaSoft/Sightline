namespace Sightline.Core;

public readonly record struct UserActivityStamp(uint TickCount);

public readonly record struct UserActivityLease(UserActivityStamp Baseline)
{
    public bool IsStillValid(UserActivityStamp current) => current == Baseline;
}

public interface IUserActivityDetector
{
    UserActivityStamp Capture();
}
