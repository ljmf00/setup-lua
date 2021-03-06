import { getInput, addPath, setFailed, exportVariable } from '@actions/core';
import { exec } from '@actions/exec';
import { cp, mv, mkdirP } from '@actions/io';
import { downloadTool, extractTar, extractZip } from '@actions/tool-cache';

import * as path from 'path'
import * as fs from 'fs'

const md5File = require('md5-file');

const SOURCE_DIRECTORY = path.join(process.cwd(), ".source/")
const INSTALL_PREFIX = path.join(process.cwd(), ".lua/")

const LUAROCKS_BUILD_PREFIX = ".build-luarocks"

const LUA_PREFIX = ".lua" // default location for existing Lua installation
const LUAROCKS_PREFIX = ".luarocks" // default location for LuaRocks installation

interface VersionAliases { [index:string]:string }

const VERSION_ALIASES : VersionAliases = {
  "5.1": "5.1.5",
  "5.2": "5.2.4",
  "5.3": "5.3.5",
  "5.4": "5.4.2",
  "luajit": "luajit-2.0.5",
  "luajit-2.0": "luajit-2.0.5",
  "luajit-2.1": "luajit-2.1.0-beta3",
}

interface TarballVersions { [index:string]:string[] }

const TARBALLS : TarballVersions = {
  "5.4.2":              ["49c92d6a49faba342c35c52e1ac3f81e", "https://www.lua.org/ftp/lua-5.4.2.tar.gz"],
  "5.4.1":              ["1d575faef1c907292edd79e7a2784d30", "https://www.lua.org/ftp/lua-5.4.1.tar.gz"],
  "5.4.0":              ["dbf155764e5d433fc55ae80ea7060b60", "https://www.lua.org/ftp/lua-5.4.0.tar.gz"],
  "5.3.5":              ["4f4b4f323fd3514a68e0ab3da8ce3455", "https://www.lua.org/ftp/lua-5.3.5.tar.gz"],
  "5.3.4":              ["53a9c68bcc0eda58bdc2095ad5cdfc63", "https://www.lua.org/ftp/lua-5.3.4.tar.gz"],
  "5.3.3":              ["703f75caa4fdf4a911c1a72e67a27498", "https://www.lua.org/ftp/lua-5.3.3.tar.gz"],
  "5.3.2":              ["33278c2ab5ee3c1a875be8d55c1ca2a1", "https://www.lua.org/ftp/lua-5.3.2.tar.gz"],
  "5.3.1":              ["797adacada8d85761c079390ff1d9961", "https://www.lua.org/ftp/lua-5.3.1.tar.gz"],
  "5.3.0":              ["a1b0a7e92d0c85bbff7a8d27bf29f8af", "https://www.lua.org/ftp/lua-5.3.0.tar.gz"],
  "5.2.4":              ["913fdb32207046b273fdb17aad70be13", "https://www.lua.org/ftp/lua-5.2.4.tar.gz"],
  "5.2.3":              ["dc7f94ec6ff15c985d2d6ad0f1b35654", "https://www.lua.org/ftp/lua-5.2.3.tar.gz"],
  "5.2.2":              ["efbb645e897eae37cad4344ce8b0a614", "https://www.lua.org/ftp/lua-5.2.2.tar.gz"],
  "5.2.1":              ["ae08f641b45d737d12d30291a5e5f6e3", "https://www.lua.org/ftp/lua-5.2.1.tar.gz"],
  "5.2.0":              ["f1ea831f397214bae8a265995ab1a93e", "https://www.lua.org/ftp/lua-5.2.0.tar.gz"],
  "5.1.5":              ["2e115fe26e435e33b0d5c022e4490567", "https://www.lua.org/ftp/lua-5.1.5.tar.gz"],
  "5.1.4":              ["d0870f2de55d59c1c8419f36e8fac150", "https://www.lua.org/ftp/lua-5.1.4.tar.gz"],
  "5.1.3":              ["a70a8dfaa150e047866dc01a46272599", "https://www.lua.org/ftp/lua-5.1.3.tar.gz"],
  "5.1.2":              ["687ce4c2a1ddff18f1008490fdc4e5e0", "https://www.lua.org/ftp/lua-5.1.2.tar.gz"],
  "5.1.1":              ["22f4f912f20802c11006fe9b84d5c461", "https://www.lua.org/ftp/lua-5.1.1.tar.gz"],
  "5.1.0":              ["3e8dfe8be00a744cec2f9e766b2f2aee", "https://www.lua.org/ftp/lua-5.1.tar.gz"],

  "luajit-2.0.5":       ["48353202cbcacab84ee41a5a70ea0a2c", "https://luajit.org/download/LuaJIT-2.0.5.tar.gz"],
  "luajit-2.1.0-beta3": ["eae40bc29d06ee5e3078f9444fcea39b", "https://luajit.org/download/LuaJIT-2.1.0-beta3.tar.gz"],
  "luajit-2.1.0-beta2": ["fa14598d0d775a7ffefb138a606e0d7b", "https://luajit.org/download/LuaJIT-2.1.0-beta2.tar.gz"],
  "luajit-2.1.0-beta1": ["5a5bf71666e77cf6e7a1ae851127b834", "https://luajit.org/download/LuaJIT-2.1.0-beta1.tar.gz"],
  "luajit-2.0.4":       ["dd9c38307f2223a504cbfb96e477eca0", "https://luajit.org/download/LuaJIT-2.0.4.tar.gz"],
  "luajit-2.0.3":       ["f14e9104be513913810cd59c8c658dc0", "https://luajit.org/download/LuaJIT-2.0.3.tar.gz"],
  "luajit-2.0.2":       ["112dfb82548b03377fbefbba2e0e3a5b", "https://luajit.org/download/LuaJIT-2.0.2.tar.gz"],
  "luajit-2.0.1":       ["85e406e8829602988eb1233a82e29f1f", "https://luajit.org/download/LuaJIT-2.0.1.tar.gz"],
  "luajit-2.0.0":       ["97a2b87cc0490784f54b64cfb3b8f5ad", "https://luajit.org/download/LuaJIT-2.0.0.tar.gz"],
}

function walkSync(dir : string, filelist: string[] | undefined = undefined) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    var full = path.join(dir, file)
    if (fs.statSync(full).isDirectory()) {
      filelist = walkSync(full, filelist);
    }
    else {
      filelist.push(full);
    }
  });
  return filelist;
};

function showDirectory(d: string) {
  for (const i of walkSync(d)) {
    console.log(i)
  }
}

function mergeDirectory(source: string, dest: string) {
  let files = fs.readdirSync(source)
  for (const i of files) {
    const full = path.join(source, i)
    const to = path.join(dest, i)
    const stats = fs.lstatSync(full);
    if (stats.isDirectory()) {
      mergeDirectory(full, to)
    }
    else {
        mkdirP(path.dirname(to))
        cp(full, to)
      }
  }
}

function getTarball(version : string) {
  const v = VERSION_ALIASES[version] || version
  if (!TARBALLS[v] || TARBALLS[v].length != 2) {
    throw RangeError("Unsupported lua version: " + version)
  }
  return [TARBALLS[v][1], TARBALLS[v][0]]
}

function getLuaVersion() {
  const luaVersion : string = getInput('lua-version', { required: false })
  return VERSION_ALIASES[luaVersion] || luaVersion || "5.1.5"
}

function getLuaRocksVersion() {
  const luaRocksVersion : string = getInput('luarocks-version', { required: false })
  return luaRocksVersion
}

function getPlatform(): string | undefined {
  const platform: string = getInput('platfrom', { required: false });
  return platform || undefined;
}

async function download(url: string, hash: string) {
  const luaSourceTar = await downloadTool(url)
  if (hash != md5File.sync(luaSourceTar)) {
    throw Error("MD5 mismatch, please check your network.");
  }
  return luaSourceTar
}

function tarballContentDirectory(version: string) {
  if (version.startsWith("luajit")) {
    const luajitVersion = getLuaVersion().substr("luajit-".length)
    return `LuaJIT-${luajitVersion}`
  }
  return `lua-${version}`
}

async function extractTarball(tarball: string, version: string) {
  await mkdirP(SOURCE_DIRECTORY)
  await exec(`cmake -E tar xzf "${tarball}"`, undefined, {
    cwd: SOURCE_DIRECTORY
  })
  showDirectory(SOURCE_DIRECTORY)
  const dir = tarballContentDirectory(version)
  return path.join(SOURCE_DIRECTORY, dir)
}

async function downloadSource(luaVersion: string) {
  const [url, hash] = getTarball(luaVersion)
  const tarball = await download(url, hash)
  return extractTarball(tarball, luaVersion)
}

async function installSystemDependencies() {
  if (process.platform == "linux") {
    return await exec("sudo apt-get install -q libreadline-dev libncurses-dev", undefined, {
      env: {
        DEBIAN_FRONTEND: "noninteractive",
        TERM: "linux"
      }
    })
  }

  if (process.platform == "darwin") {
    return
  }

  if (process.platform == "win32") { // even Windows 64 bit.
    // No dependencies needs to be installed.
    return
  }
}

async function addCMakeBuildScripts(sourcePath: string, luaVersion: string) {
  fs.unlinkSync(path.join(sourcePath, "src", "luaconf.h"))
  mergeDirectory(path.join(__dirname, "..", "patch", "shared"), sourcePath)
  const v = luaVersion.replace(/\.\d*$/,'')
  mergeDirectory(path.join(__dirname, "..", "patch", "lua", v), sourcePath)
  console.log("VERSION: " + v)
  showDirectory(sourcePath)
}

async function buildAndInstall(sourcePath: string, platform: string | undefined) {

  if(platform){
    await exec(`cmake -H"${sourcePath}" -Bbuild -DCMAKE_INSTALL_PREFIX=${INSTALL_PREFIX} -A${platform}`, undefined, {
      cwd: sourcePath
    })
  }
  else{
    await exec(`cmake -H"${sourcePath}" -Bbuild -DCMAKE_INSTALL_PREFIX=${INSTALL_PREFIX}`, undefined, {
      cwd: sourcePath
    })
  }

  await exec(`cmake --build build --config Release --target install`, undefined, {
    cwd: sourcePath
  })

  addPath(path.join(INSTALL_PREFIX, "bin"));
}

async function installLuaRocks(luaRocksVersion: string, platform: string | undefined)
{
  const luaRocksExtractPath: string = path.join(process.env["RUNNER_TEMP"], LUAROCKS_BUILD_PREFIX, `luarocks-${luaRocksVersion}`)
  const luaRocksInstallPath: string = path.join(process.cwd(), LUAROCKS_PREFIX)

  const luaInstallPath = path.join(process.cwd(), LUA_PREFIX)

  if (process.platform != "win32") {

    const sourceTar = await downloadTool(`https://luarocks.org/releases/luarocks-${luaRocksVersion}.tar.gz`)
    await mkdirP(luaRocksExtractPath)
    await extractTar(sourceTar, path.join(process.env["RUNNER_TEMP"], LUAROCKS_BUILD_PREFIX))

    const configureArgs = []
    configureArgs.push(`--with-lua="${luaInstallPath}"`)
    configureArgs.push(`--prefix="${luaRocksInstallPath}"`)

    await exec(`./configure ${configureArgs.join(" ")}`, undefined, {
      cwd: luaRocksExtractPath
    })

    await exec("make", undefined, {
      cwd: luaRocksExtractPath
    })

    // NOTE: make build step is only necessary for luarocks 2.x
    if (luaRocksVersion.match(/^2\./)) {
      await exec("make build", undefined, {
        cwd: luaRocksExtractPath
      })
    }

    await exec("make install", undefined, {
      cwd: luaRocksExtractPath
    })

    // Update environment to use luarocks directly
    let lrPath = ""

    await exec(`${path.join(luaRocksInstallPath, "bin", "luarocks")} path --lr-bin`, undefined, {
      listeners: {
        stdout: (data) => {
          lrPath += data.toString()
        }
      }
    })

    if (lrPath != "") {
      addPath(lrPath.trim());
    }

    let luaPath = ""

    await exec("luarocks path --lr-path", undefined, {
      listeners: {
        stdout: (data) => {
          luaPath += data.toString()
        }
      }
    })

    luaPath = luaPath.trim()

    let luaCpath = ""

    await exec("luarocks path --lr-cpath", undefined, {
      listeners: {
        stdout: (data) => {
          luaCpath += data.toString()
        }
      }
    })

    luaCpath = luaCpath.trim()

    if (luaPath != "") {
      exportVariable("LUA_PATH", ";;" + luaPath)
    }

    if (luaCpath != "") {
      exportVariable("LUA_CPATH", ";;" + luaCpath)
    }
  } else {
    const arch = (platform && platform == "x64") ? "64" : "32"
    const sourceZip = await downloadTool(`https://luarocks.github.io/luarocks/releases/luarocks-${luaRocksVersion}-windows-${arch}.zip`)
    await mkdirP(luaRocksInstallPath)

    const binInstallPath = path.join(luaRocksInstallPath, "bin")
    await mkdirP(binInstallPath)

    const extractPath = path.join(process.env["RUNNER_TEMP"], "luarocks")
    await mkdirP(extractPath)
    await extractZip(sourceZip, extractPath)

    const extractedFolder = path.join(extractPath, `luarocks-${luaRocksVersion}-windows-${arch}`)
    await fs.stat(path.join(extractedFolder, `luarocks-admin.exe`), async function(err, stat) {
        if(err == null) {
          await mv(
            path.join(extractedFolder, `luarocks-admin.exe`),
            binInstallPath
          )
        }
    })

    await mv(
      path.join(extractedFolder, `luarocks.exe`),
      binInstallPath
    )

    showDirectory(binInstallPath)
    addPath(binInstallPath)

    if (arch == "64")
    {
      mkdirP("C:/Program Files/luarocks/");
    } else {
      mkdirP("C:/Program Files (x86)/luarocks/");
    }

    mkdirP(`${process.env.APPDATA}\\luarocks`);

    const luaVersion = getLuaVersion()
    const shortLuaVersion = luaVersion.split('.').slice(0,2).join('.')

    await exec(`luarocks config --scope system lua_dir ${luaInstallPath}`, undefined, {
      cwd: binInstallPath
    })
    await exec(`luarocks config --scope system lua_version ${shortLuaVersion}`, undefined, {
      cwd: binInstallPath
    })

    await exec(`luarocks config --scope user lua_dir ${luaInstallPath}`, undefined, {
      cwd: binInstallPath
    })
    await exec(`luarocks config --scope user lua_version ${shortLuaVersion}`, undefined, {
      cwd: binInstallPath
    })
  }
}

async function main() {
  const luaVersion = getLuaVersion()
  const luaRocksVersion = getLuaRocksVersion()
  const platform = getPlatform()

  await installSystemDependencies()
  const sourcePath = await downloadSource(luaVersion)
  await addCMakeBuildScripts(sourcePath, luaVersion)

  await buildAndInstall(sourcePath, platform)

  const isLuaRocks : string = getInput('install-luarocks', { required: false })
  if (isLuaRocks == 'true') {
    await installLuaRocks(luaRocksVersion, platform)
  }
}

// main().catch(err => {
//   setFailed(`Failed to install Lua: ${err}`);
// })

main()
