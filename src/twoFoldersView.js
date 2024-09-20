const vscode = require("vscode");
const path = require('path');
const os = require('os');
const isBinaryFile = require("isbinaryfile").isBinaryFile;
const { restApiCompare, restApiUpload } = require('./rest-api');
const { openFile } = require('./openFile');


export async function showTwoFoldersView(bothFoldersContents, folder1Path, isFolder1Local, folder1Config, folder2Path, isFolder2Local, folder2Config) {

   const panel = vscode.window.createWebviewPanel(
      "folderContents",  // webview identifier
      // `${isLocal ? "Local" : "Remote "+config.label} Folder Contents`,
      `${path.basename(folder1Path)}/${" ("+folder1Config.label+" ↔ "+folder2Config.label+")"}`, // title displayed
      vscode.ViewColumn.One,
      {
         enableScripts: true, // Allow running JavaScript in the Webview
      }
   );

   // provide more details in tooltip displayed when hovering over the tooltip - does not work!
   panel.title = `${path.basename(folder1Path)}/${" ("+folder1Config.label+" ↔ "+folder2Config.label+")"}`;
   panel.description = `${folder1Path}/ (${folder1Config.label}) ↔ ${folder2Path}/ (${folder2Config.label})}`;

   // Set the HTML content
   panel.webview.html = getWebviewContent(bothFoldersContents, folder1Path, isFolder1Local, folder1Config, folder2Path, isFolder2Local, folder2Config);

   // Handle messages from the Webview
   panel.webview.onDidReceiveMessage(
      async (message) => {
         let fileUri, ext;
         switch (message.command) {
            case "openLocalFile":
               fileUri = vscode.Uri.file(message.filePath);
               ext = path.extname(message.filePath).toLowerCase();
               const action = await vscode.window.showQuickPick(['Open', 'Upload', 'Compare to Remote']);
               if (action === 'Upload') {
                  return restApiUpload(message.filePath);
               } else if (action === 'Compare to Remote') {
                  return restApiCompare(message.filePath);
               } else if (action === 'Open') {
                  try {
                     switch (ext) {
                        case '.docx':
                        case '.html':
                        case '.md':
                           vscode.commands.executeCommand('vscode.open', fileUri);
                           break;
                        case '.pdf':
                        case '.xlsx':
                        case '.xls':
                        case '.rtf':
                              openFile(fileUri);
                           break;
                        default:
                           const isBinary = await isBinaryFile(message.filePath);
                           if (! isBinary) {
                              // Open the local file in the editor
                              const document = await vscode.workspace.openTextDocument(fileUri);
                              vscode.window.showTextDocument(document);
                           } else {
                              if (os.platform() === 'win32'){
                                 openFile(fileUri);
                              } else {
                                 vscode.commands.executeCommand('vscode.open', fileUri);
                              }
                           }
                           break;
                     }
                  } catch (error) {
                     vscode.window.showErrorMessage(
                        `Failed to open file: ${error.message}`
                     );
                  }
               }
               return;

               case "openRemoteFile":
                  fileUri = vscode.Uri.file(message.filePath);
                  ext = path.extname(message.filePath).toLowerCase();
                  try {
                     if (typeof message.config === 'string' && message.config.trim().charAt(0) === '{') {
                        message.config = JSON.parse(message.config);
                     }
                     if (message?.config?.remoteEndpoint?.url) {
                        // Ask what to do with remote file: download, compare to local, delete ?
                        const action = await vscode.window.showQuickPick(['View', 'Download', 'Compare to Local']);
                        const msg = `Action not yet implemented: ${action} for ${message?.config?.label} remote file: ${message.filePath}`;
                        console.log(msg);
                        vscode.window.showWarningMessage(msg);
                     } else {
                        console.log("(openRemoteFile) Unexpected message:", message);
                     }
                  } catch (error) {
                     vscode.window.showErrorMessage(
                        `Failed to open remote file: ${error.message}`
                     );
                  }
                  return;         }
      },
      undefined,
      undefined
   );

}


function getWebviewContent(bothFoldersContents, folder1Path, isFolder1Local, folder1Config, folder2Path, isFolder2Local, folder2Config) {
   const class1link = `${folder1Config.label}-link`.replaceAll(/\W/g, '-');
   const class2link = `${folder2Config.label}-link`.replaceAll(/\W/g, '-');
   return `
      <html>
         <head>
         <style>
            h2 {
               word-wrap: break-word; /* Ensures long strings break */
            }
            table {
               table-layout: fixed;
               width: 100%;
               border-collapse: separate;
               border-spacing: 3px 0; 
            }
            th, td {
               padding: 2px;
               text-align: left;
               border-bottom: 1px solid #ddd;
            }
            th {
               cursor: pointer;
            }
            /* Apply these styles to all cells in the first column */
            td:nth-child(1), th:nth-child(1), td:nth-child(6), th:nth-child(6) {
               overflow: hidden;
               white-space: nowrap;
               /*
               text-overflow: ellipsis;
               max-width: 30%; 
               */
            }
            td:nth-child(2), th:nth-child(2), td:nth-child(7), th:nth-child(7) { 
               text-align: end;  
            }
            td:nth-child(3), th:nth-child(3), td:nth-child(4), th:nth-child(4),
            td:nth-child(8), th:nth-child(8), td:nth-child(9), th:nth-child(9) { 
               overflow: hidden;
               white-space: nowrap;
               margin-right: 2px;
            }
         /* Assign proportional widths for local, remote, and spacer columns */
         .local-folder, .remote-folder {
            width: 48%;
         }
         .spacer {
            width: 4%; /* Spacer takes up 6% of the total table width */
            background-color: white;
            border: none; /* No border for the spacer */
            cursor: auto;
         }
         .folder-header {
            text-align: center;
            font-weight: bold;
         }
         .higher {
            color: pink; /* Higher values */
         }
         .lower {
            color: lightblue; /* Lower values */
         }
         .differ {
            color: brown; /* Lower values */
         }
         </style>
         </head>
         <body>
         <!--h2>Contents of ${isFolder1Local ? "local" : folder1Config.label} folder: ${folder1Path}</h2-->
         <h2>${path.basename(folder1Path)}/ (${folder1Config.label} ↔ ${folder2Config.label})</h2>
         <table id="folderTable">
            <colgroup>
               <col style="width: 25%;">
               <col style="width: 7%;">
               <col style="width: 9ch;">
               <col style="width: 6ch;">
               <col style="width: 2%;">
               <col style="width: 25%;">
               <col style="width: 7%;">
               <col style="width: 9ch;">
               <col style="width: 6ch;">
            </colgroup>
            <thead>
               <tr>
                  <!-- Headers for Local and Remote sections -->
                  <th colspan="4" class="local-folder folder-header">${folder1Config.label}: ${folder1Path}</th>
                  <th class="spacer"></th> <!-- Spacer column between the two sections -->
                  <th colspan="4" class="remote-folder folder-header">${folder2Config.label}: ${folder2Path}</th>
               </tr>
               <tr>
               <th onclick="sortTable(0)">Name</th>
               <th onclick="sortTable(1)">Size</th>
               <th onclick="sortTable(2)">Last Modified</th>
               <th onclick="sortTable(3)">MD5sum</th>
               <th class="spacer"></th>
               <th onclick="sortTable(5)">Name</th>
               <th onclick="sortTable(6)">Size</th>
               <th onclick="sortTable(7)">Last Modified</th>
               <th onclick="sortTable(8)">MD5sum</th>
               </tr>
            </thead>
            <tbody>
               ${bothFoldersContents
               .map(
                  (file) => `
                  <tr>
                     <td><a href="#" class="${class1link}" data-path="${path.join(folder1Path, file.name1)}">${file.name1}</a></td>
                     <td${file.size1  !== file.size2  ? ' class="'+(file.size1  > file.size2  ? 'higher' : 'lower')+'"' : ''}>${file.size1}</td>
                     <td${file.mtime1 !== file.mtime2 ? ' class="'+(file.mtime1 > file.mtime2 ? 'higher' : 'lower')+'"' : ''}>${file.mtime1}</td>
                     <td${file.md5sum1 !== file.md5sum2 ? ' class="differ"' : ''}>${file.md5sum1}</td>
                     <td class="spacer"> </td> <!-- Spacer column between the two sections -->
                     <td><a href="#" class="${class2link}" data-path="${folder2Path}/${file.name2}">${file.name2}</a></td>
                     <td${file.size1  !== file.size2  ? ' class="'+(file.size1  < file.size2  ? 'higher' : 'lower')+'"' : ''}>${file.size2}</td>
                     <td${file.mtime1 !== file.mtime2 ? ' class="'+(file.mtime1 < file.mtime2 ? 'higher' : 'lower')+'"' : ''}>${file.mtime2}</td>
                     <td${file.md5sum1 !== file.md5sum2 ? ' class="differ"' : ''}>${file.md5sum2}</td>
                  </tr>
                  `
               )
               .join("")}
            </tbody>
         </table>

         <script>
            const vscode = acquireVsCodeApi();

            document.querySelectorAll('.${class1link}').forEach(link => {
               link.addEventListener('click', event => {
               event.preventDefault();
               const filePath = event.target.getAttribute('data-path');
               msg = {
                  command: 'openLocalFile',
                  filePath: filePath
               };
               console.log('vscode.postMessage:', JSON.stringify(msg));
               vscode.postMessage(msg);
               });
            });

            document.querySelectorAll('.${class2link}').forEach(link => {
               link.addEventListener('click', event => {
               event.preventDefault();
               const filePath = event.target.getAttribute('data-path');
               msg = {
                  command: 'openRemoteFile',
                  filePath: filePath,
                  config: '${JSON.stringify(folder2Config)}'
               };
               console.log('vscode.postMessage:', JSON.stringify(msg));
               vscode.postMessage(msg);
               });
            });

            function sortTable(n) {
               const table = document.getElementById("folderTable");
               let switching = true, rows, i, x, y, xVal, yVal, shouldSwitch, dir = "asc", switchCount = 0;
               while (switching) {
                  switching = false;
                  rows = table.rows;
                  for (i = 1; i < (rows.length - 1); i++) {
                     shouldSwitch = false;
                     x = rows[i].getElementsByTagName("TD")[n];
                     y = rows[i + 1].getElementsByTagName("TD")[n];
                     xVal = (x?.textContent || '').trim().toLowerCase();
                     yVal = (y?.textContent || '').trim().toLowerCase();

                     // Check if both values are numeric
                     const xNum = xVal === '' ? -1 : parseFloat(xVal);
                     const yNum = yVal === '' ? -1 : parseFloat(yVal);
                     const bothNumeric = !isNaN(xNum) && !isNaN(yNum)  && !xVal.match(/[^\\d]/i);                     

                     if (dir === "asc") {
                        if (bothNumeric) {
                           if (xNum > yNum) {
                              shouldSwitch = true;
                              break;
                           }
                        } else {
                           if (xVal > yVal) {
                              shouldSwitch = true;
                              break;
                           }
                        }
                     } else if (dir === "desc") {
                        if (bothNumeric) {
                           if (xNum < yNum) {
                              shouldSwitch = true;
                              break;
                           }
                        } else {
                           if (xVal < yVal) {
                              shouldSwitch = true;
                              break;
                           }
                        }
                     }
                  }
                  if (shouldSwitch) {
                     rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                     switching = true;
                     switchCount++;
                  } else {
                     if (switchCount === 0 && dir === "asc") {
                     dir = "desc";
                     switching = true;
                     }
                  }
               }
            }

         </script>
         </body>
      </html>
   `;
}


