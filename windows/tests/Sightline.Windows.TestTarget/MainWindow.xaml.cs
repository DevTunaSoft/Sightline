using System.Windows;

namespace Sightline.Windows.TestTarget;

public partial class MainWindow : Window
{
    public MainWindow() => InitializeComponent();

    private void ApplyButton_Click(object sender, RoutedEventArgs e)
    {
        ResultText.Text = $"Applied:{InputBox.Text}";
        ReadyCheck.IsChecked = true;
    }
}
