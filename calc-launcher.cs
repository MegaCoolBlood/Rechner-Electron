using System;
using System.Diagnostics;
using System.IO;

class CalculatorLauncher
{
    static void Main()
    {
        try
        {
            // Get the directory where this executable is located
            string exePath = System.Reflection.Assembly.GetExecutingAssembly().Location;
            string baseDir = Path.GetDirectoryName(exePath);
            
            // Navigate to the Rechner-Electron directory
            string projectDir = Path.Combine(baseDir, "..", "..", "Rechner-Electron");
            string electronPath = Path.Combine(projectDir, "node_modules", "electron", "dist", "electron.exe");
            string mainJsPath = Path.Combine(projectDir, "src", "main.js");
            
            // Resolve to absolute paths
            electronPath = Path.GetFullPath(electronPath);
            mainJsPath = Path.GetFullPath(mainJsPath);
            
            if (!File.Exists(electronPath))
            {
                // Fallback: try direct path
                projectDir = @"D:\Repositories\Rechner-Electron";
                electronPath = Path.Combine(projectDir, "node_modules", "electron", "dist", "electron.exe");
                mainJsPath = Path.Combine(projectDir, "src", "main.js");
            }
            
            if (File.Exists(electronPath) && File.Exists(mainJsPath))
            {
                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = electronPath,
                    Arguments = "\"" + mainJsPath + "\"",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                
                Process.Start(startInfo);
            }
        }
        catch
        {
            // Silently fail - don't show error dialogs
        }
    }
}
