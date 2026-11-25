package com.codemobile.app;

import android.system.Os;
import android.system.OsConstants;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Linux embutido: Alpine (rootfs) rodando via proot, tudo dentro do app. Sem servidor, sem Termux. */
@CapacitorPlugin(name = "Shell")
public class ShellPlugin extends Plugin {
  private static final Set<String> IGN = new HashSet<>(Arrays.asList("node_modules", ".git", ".cache", ".npm", "__pycache__", ".venv"));

  private File root() { return new File(getContext().getFilesDir(), "alpine"); }
  private File lib(String n) { return new File(getContext().getApplicationInfo().nativeLibraryDir, n); }
  private boolean ready() { return new File(root(), ".ok").exists(); }
  private boolean hasRootfs() { try { getContext().getAssets().open("rootfs.bin").close(); return true; } catch (IOException e) { return false; } }

  @PluginMethod
  public void status(PluginCall call) {
    JSObject o = new JSObject();
    o.put("available", lib("libproot.so").exists() && lib("libproot-loader.so").exists() && hasRootfs());
    o.put("ready", ready());
    o.put("lib", lib("libproot.so").exists()); o.put("loader", lib("libproot-loader.so").exists()); o.put("rootfs", hasRootfs());
    call.resolve(o);
  }

  /** apaga o Linux embutido (o projeto não é afetado) para reinstalar do zero */
  @PluginMethod
  public void reset(final PluginCall call) {
    new Thread(() -> { deleteRec(root()); call.resolve(); }).start();
  }

  /** teste real: o proot precisa iniciar um /bin/sh dentro do rootfs neste aparelho */
  private String selfTest(File r) throws Exception {
    File tmp = new File(getContext().getCacheDir(), "proot-tmp"); tmp.mkdirs();
    ProcessBuilder pb = new ProcessBuilder(lib("libproot.so").getPath(), "-0", "--link2symlink", "--kill-on-exit", "-r", r.getPath(), "-b", "/dev", "-b", "/proc", "-w", "/", "/bin/sh", "-c", "echo ok; uname -m");
    pb.redirectErrorStream(true);
    Map<String, String> env = pb.environment(); env.clear();
    env.put("PROOT_LOADER", lib("libproot-loader.so").getPath()); env.put("PROOT_TMP_DIR", tmp.getPath()); env.put("PROOT_NO_SECCOMP", "1"); env.put("PATH", "/usr/bin:/bin");
    final Process p = pb.start(); final StringBuilder sb = new StringBuilder();
    Thread rd = new Thread(() -> {
      try (InputStream in = p.getInputStream()) { byte[] b = new byte[4096]; int n; while ((n = in.read(b)) > 0) synchronized (sb) { sb.append(new String(b, 0, n, StandardCharsets.UTF_8)); } } catch (IOException e) { }
    });
    rd.start(); rd.join(20000); if (rd.isAlive()) p.destroy();
    synchronized (sb) { return sb.toString(); }
  }

  @PluginMethod
  public void install(final PluginCall call) {
    new Thread(() -> {
      try {
        File r = root();
        if (!ready()) {
          deleteRec(r); r.mkdirs();
          try (InputStream in = getContext().getAssets().open("rootfs.bin")) { untar(in, r); }
          new File(r, "tmp").mkdirs(); new File(r, "work").mkdirs(); new File(r, "root").mkdirs(); new File(r, "etc").mkdirs();
          try (FileOutputStream o = new FileOutputStream(new File(r, "etc/resolv.conf"))) { o.write("nameserver 8.8.8.8\nnameserver 1.1.1.1\n".getBytes(StandardCharsets.UTF_8)); }
          String t = selfTest(r);
          if (!t.trim().startsWith("ok")) { deleteRec(r); call.reject("O Linux foi extraído, mas o proot não conseguiu iniciar neste aparelho:\n" + (t.length() > 700 ? t.substring(0, 700) : t)); return; }
          new File(r, ".ok").createNewFile();
        }
        JSObject o = new JSObject(); o.put("ready", true); call.resolve(o);
      } catch (Exception e) { call.reject("Falha ao instalar o Linux embutido: " + e); }
    }).start();
  }

  @PluginMethod
  public void exec(final PluginCall call) {
    new Thread(() -> {
      try {
        if (!ready()) { call.reject("Linux embutido não instalado"); return; }
        String cmd = call.getString("cmd", "");
        if (cmd == null || cmd.trim().isEmpty()) { call.reject("cmd vazio"); return; }
        String raw = call.getString("project", "projeto");
        String project = raw.replaceAll("[^\\w.-]+", "_").replaceAll("^\\.+", "_");
        if (project.length() > 48) project = project.substring(0, 48);
        if (project.isEmpty()) project = "projeto";
        if (!project.equals(raw)) project += "-" + sha8(raw);   // nomes diferentes nunca colidem
        int to = Math.max(1, Math.min(call.getInt("timeout", 60), 600));
        File base = new File(getContext().getFilesDir(), "ws/" + project); base.mkdirs();

        // 1) projeto (memória do app) -> pasta no disco
        JSObject files = call.getObject("files", new JSObject());
        Set<String> keep = new HashSet<>();
        String baseCanon = base.getCanonicalPath() + File.separator;
        Map<String, String> disk = new TreeMap<>(); walk(base, "", disk);
        Iterator<String> it = files.keys();
        while (it.hasNext()) {
          String k = it.next();
          if (k.startsWith("/") || k.contains("../")) continue;
          String v = files.optString(k, "");
          keep.add(k);
          if (!v.equals(disk.get(k))) {
            File f = new File(base, k); f.getParentFile().mkdirs();
            if (!f.getCanonicalPath().startsWith(baseCanon) || isLink(f)) continue;   // nunca escreve fora do projeto
            write(f, v);
          }
        }
        // só apaga o que o app gerenciava e removeu; arquivos desconhecidos/externos ficam
        File mf = new File(getContext().getFilesDir(), "manifest/" + project + ".txt"); mf.getParentFile().mkdirs();
        Set<String> man = new HashSet<>();
        if (mf.exists()) for (String ln : new String(readAll(mf), StandardCharsets.UTF_8).split("\n")) if (!ln.isEmpty()) man.add(ln);
        for (String k : man) if (!keep.contains(k)) { File f = new File(base, k); if (f.getCanonicalPath().startsWith(baseCanon) && !isLink(f)) f.delete(); }
        Map<String, String> before = new TreeMap<>(); walk(base, "", before);

        // 2) roda no Alpine via proot
        File tmp = new File(getContext().getCacheDir(), "proot-tmp"); tmp.mkdirs();
        List<String> a = new ArrayList<>(Arrays.asList(lib("libproot.so").getPath(), "-0", "--link2symlink", "--kill-on-exit",
            "-r", root().getPath(), "-b", "/dev", "-b", "/proc", "-b", base.getPath() + ":/work", "-w", "/work", "/bin/sh", "-c", cmd));
        ProcessBuilder pb = new ProcessBuilder(a); pb.redirectErrorStream(true);
        Map<String, String> env = pb.environment(); env.clear();
        env.put("PROOT_LOADER", lib("libproot-loader.so").getPath()); env.put("PROOT_TMP_DIR", tmp.getPath()); env.put("PROOT_NO_SECCOMP", "1");
        env.put("HOME", "/root"); env.put("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"); env.put("TERM", "dumb"); env.put("LANG", "C.UTF-8");
        env.put("CI", "1"); env.put("PAGER", "cat"); env.put("GIT_PAGER", "cat"); env.put("GIT_TERMINAL_PROMPT", "0"); env.put("GIT_EDITOR", "true");
        env.put("TMPDIR", "/tmp"); env.put("PYTHONUNBUFFERED", "1");
        final Process p = pb.start();
        final StringBuilder sb = new StringBuilder();
        Thread rd = new Thread(() -> {
          try (InputStream in = p.getInputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = in.read(buf)) > 0) { synchronized (sb) { sb.append(new String(buf, 0, n, StandardCharsets.UTF_8)); if (sb.length() > 60000) sb.delete(0, sb.length() - 30000); } }
          } catch (IOException e) { }
        });
        rd.start();
        long end = System.currentTimeMillis() + to * 1000L; boolean timedOut = false; int code = -1;
        while (true) {
          try { code = p.exitValue(); break; }
          catch (IllegalThreadStateException e) {
            if (System.currentTimeMillis() > end) { timedOut = true; p.destroy(); break; }
            try { Thread.sleep(80); } catch (InterruptedException ie) { }
          }
        }
        rd.join(1500);

        // 3) o que mudou no disco volta para o projeto
        Map<String, String> after = new TreeMap<>(); walk(base, "", after);
        JSObject ch = new JSObject(); JSArray del = new JSArray();
        for (Map.Entry<String, String> e : after.entrySet()) if (!e.getValue().equals(before.get(e.getKey()))) ch.put(e.getKey(), e.getValue());
        for (String k : before.keySet()) if (!after.containsKey(k)) del.put(k);
        Set<String> known = new HashSet<>(keep);
        Iterator<String> ck = ch.keys(); while (ck.hasNext()) known.add(ck.next());
        for (String k : before.keySet()) if (!after.containsKey(k)) known.remove(k);
        StringBuilder mb = new StringBuilder(); for (String k : known) mb.append(k).append('\n');
        write(mf, mb.toString());
        String out; synchronized (sb) { out = sb.toString(); }
        if (out.length() > 12000) out = out.substring(out.length() - 12000);
        JSObject r = new JSObject();
        r.put("code", code); r.put("out", out); r.put("timedOut", timedOut); r.put("changed", ch); r.put("deleted", del);
        call.resolve(r);
      } catch (Exception e) { call.reject("Erro no terminal: " + e); }
    }).start();
  }

  // ---------- utilidades ----------
  private static String sha8(String s) throws Exception {
    byte[] d = java.security.MessageDigest.getInstance("SHA-1").digest(s.getBytes(StandardCharsets.UTF_8));
    StringBuilder b = new StringBuilder(); for (int i = 0; i < 4; i++) b.append(String.format("%02x", d[i])); return b.toString();
  }

  private static boolean isLink(File f) { try { return OsConstants.S_ISLNK(Os.lstat(f.getPath()).st_mode); } catch (Exception e) { return false; } }

  private void deleteRec(File f) {
    try { if (OsConstants.S_ISDIR(Os.lstat(f.getPath()).st_mode)) { File[] c = f.listFiles(); if (c != null) for (File x : c) deleteRec(x); } } catch (Exception e) { }
    f.delete();
  }

  private void walk(File base, String rel, Map<String, String> out) {
    File[] fs = new File(base, rel).listFiles();
    if (fs == null) return;
    Arrays.sort(fs);
    for (File f : fs) {
      String n = f.getName();
      if (IGN.contains(n) || isLink(f)) continue;
      String r = rel.isEmpty() ? n : rel + "/" + n;
      if (f.isDirectory()) walk(base, r, out);
      else if (f.isFile() && out.size() < 600 && f.length() <= 200000) {
        try {
          byte[] b = readAll(f); boolean bin = false;
          for (byte x : b) if (x == 0) { bin = true; break; }
          if (!bin) out.put(r, new String(b, StandardCharsets.UTF_8));
        } catch (IOException e) { }
      }
    }
  }

  private static byte[] readAll(File f) throws IOException {
    try (FileInputStream in = new FileInputStream(f)) {
      ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[8192]; int n;
      while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
      return o.toByteArray();
    }
  }

  private static void write(File f, String s) throws IOException { try (FileOutputStream o = new FileOutputStream(f)) { o.write(s.getBytes(StandardCharsets.UTF_8)); } }

  private static void copy(File a, File b) throws IOException {
    try (FileInputStream in = new FileInputStream(a); FileOutputStream o = new FileOutputStream(b)) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) o.write(buf, 0, n); }
  }

  private static String cstr(byte[] b, int off, int len) { int e = off; while (e < off + len && b[e] != 0) e++; return new String(b, off, e - off, StandardCharsets.UTF_8); }
  private static long oct(byte[] b, int off, int len) { String s = cstr(b, off, len).trim(); return s.isEmpty() ? 0 : Long.parseLong(s, 8); }

  private static void skipN(DataInputStream in, long n) throws IOException {
    while (n > 0) { int k = in.skipBytes((int) Math.min(n, Integer.MAX_VALUE)); if (k <= 0) { if (in.read() < 0) break; k = 1; } n -= k; }
  }

  /** tar.gz -> pasta (arquivos, pastas, symlinks e hardlinks; sem depender de nada externo) */
  private void untar(InputStream raw, File dest) throws Exception {
    DataInputStream in = new DataInputStream(new BufferedInputStream(new GZIPInputStream(raw), 1 << 16));
    byte[] h = new byte[512]; String longName = null;
    while (true) {
      try { in.readFully(h); } catch (EOFException e) { break; }
      if (h[0] == 0) break;
      String name = cstr(h, 0, 100); long size = oct(h, 124, 12); int mode = (int) oct(h, 100, 8); char t = (char) h[156]; String link = cstr(h, 157, 100);
      if ("ustar".equals(cstr(h, 257, 5))) { String pre = cstr(h, 345, 155); if (!pre.isEmpty()) name = pre + "/" + name; }
      long pad = (512 - size % 512) % 512;
      if (t == 'L') { byte[] b = new byte[(int) size]; in.readFully(b); skipN(in, pad); longName = cstr(b, 0, b.length); continue; }
      if (t == 'x' || t == 'g' || t == 'K') { skipN(in, size + pad); continue; }
      if (longName != null) { name = longName; longName = null; }
      while (name.startsWith("./")) name = name.substring(2);
      while (name.startsWith("/")) name = name.substring(1);
      if (name.isEmpty() || name.equals(".") || name.equals("..") || name.contains("../")) { skipN(in, size + pad); continue; }
      File f = new File(dest, name);
      f.getParentFile().mkdirs();
      if (t == '5') { f.mkdirs(); f.setReadable(true, false); f.setWritable(true, true); f.setExecutable(true, false); }
      else if (t == '2') { f.delete(); Os.symlink(link, f.getPath()); }
      else if (t == '1') { copy(new File(dest, link.replaceFirst("^\\./", "")), f); f.setExecutable((mode & 0111) != 0, false); }
      else if (t == '0' || t == '\0' || t == '7') {
        try (FileOutputStream o = new FileOutputStream(f)) {
          byte[] buf = new byte[1 << 16]; long left = size;
          while (left > 0) { int n = in.read(buf, 0, (int) Math.min(buf.length, left)); if (n < 0) throw new EOFException(); o.write(buf, 0, n); left -= n; }
        }
        f.setReadable(true, false); f.setWritable(true, true); f.setExecutable((mode & 0111) != 0, false);
        skipN(in, pad);
        continue;
      }
      skipN(in, size + pad);
    }
  }
}
