#!/bin/sh
# Exports RealityHD catalog props to GLB (three.js / WebXR) and USDZ (Quick Look, visionOS) into web/public/models.
set -e
cd "$(dirname "$0")/.."
OUT="$PWD/web/public/models"
mkdir -p "$OUT"
( cd ../RealityHD && swift build -c release --product realityhd >/dev/null )
for id in desktop-monitor laptop; do ../RealityHD/.build/release/realityhd export "$id" --lod 1 --size 512 --out "$OUT"; done

# Fallback: realityhd's USDZ step needs Blender (/opt/homebrew/bin/blender is a dangling cask wrapper).
# Convert each GLB to USDZ with stdlib python (UsdPreviewSurface, PNG textures, 64-byte aligned stored zip).
for id in desktop-monitor laptop; do
  if [ ! -s "$OUT/$id.usdz" ] || [ "$OUT/$id.glb" -nt "$OUT/$id.usdz" ]; then
    python3 -I - "$OUT/$id.glb" "$OUT/$id.usdz" <<'PY'
import sys, struct, json, zipfile, io
glb, out = sys.argv[1:3]
d = open(glb, 'rb').read()
jl = struct.unpack('<I', d[12:16])[0]
j = json.loads(d[20:20 + jl])
bs = d[20 + jl + 8:]
def view(i):
    v = j['bufferViews'][i]; o = v.get('byteOffset', 0)
    return bs[o:o + v['byteLength']]
def acc(i):
    a = j['accessors'][i]; v = j['bufferViews'][a['bufferView']]
    o = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    fmt = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[a['componentType']]
    vals = struct.unpack_from('<%d%s' % (a['count'] * n, fmt), bs, o)
    return [vals[k:k + n] for k in range(0, len(vals), n)] if n > 1 else list(vals)
def tup(t): return '(' + ', '.join(repr(round(x, 6)) if isinstance(x, float) else str(x) for x in t) + ')'
files = {}
def tex(t):
    n = 'tex%d.png' % j['textures'][t]['source']
    files[n] = view(j['images'][j['textures'][t]['source']]['bufferView'])
    return n
def sname(s): return ''.join(c if c.isalnum() else '_' for c in s)
mats = []
L = ['#usda 1.0', '(', '    defaultPrim = "Root"', '    metersPerUnit = 1', '    upAxis = "Y"', ')', '', 'def Xform "Root"', '{']
mnames = []
for mi, m in enumerate(j['materials']):
    nm = 'mat%d_%s' % (mi, sname(m.get('name', '')))
    mnames.append(nm)
L.append('    def Scope "Materials"\n    {')
for mi, m in enumerate(j['materials']):
    nm = mnames[mi]; p = m.get('pbrMetallicRoughness', {})
    L += ['        def Material "%s"' % nm, '        {',
          '            token outputs:surface.connect = </Root/Materials/%s/pbr.outputs:surface>' % nm,
          '            def Shader "st"', '            {', '                uniform token info:id = "UsdPrimvarReader_float2"',
          '                string inputs:varname = "st"', '                float2 outputs:result', '            }',
          '            def Shader "pbr"', '            {', '                uniform token info:id = "UsdPreviewSurface"']
    def texshader(name, t, extra, outs):
        f = tex(t)
        s = ['            def Shader "%s"' % name, '            {', '                uniform token info:id = "UsdUVTexture"',
             '                asset inputs:file = @%s@' % f,
             '                float2 inputs:st.connect = </Root/Materials/%s/st.outputs:result>' % nm,
             '                token inputs:wrapS = "repeat"', '                token inputs:wrapT = "repeat"'] + extra
        s += ['                %s outputs:%s' % o for o in outs] + ['            }']
        return s
    sh = []
    if 'baseColorTexture' in p:
        L.append('                color3f inputs:diffuseColor.connect = </Root/Materials/%s/base.outputs:rgb>' % nm)
        sh += texshader('base', p['baseColorTexture']['index'], ['                token inputs:sourceColorSpace = "sRGB"'], [('float3', 'rgb')])
    else:
        bc = p.get('baseColorFactor', [1, 1, 1, 1])[:3]
        L.append('                color3f inputs:diffuseColor = %s' % tup(bc))
    if 'metallicRoughnessTexture' in p:
        L += ['                float inputs:roughness.connect = </Root/Materials/%s/mr.outputs:g>' % nm,
              '                float inputs:metallic.connect = </Root/Materials/%s/mr.outputs:b>' % nm]
        sh += texshader('mr', p['metallicRoughnessTexture']['index'], ['                token inputs:sourceColorSpace = "raw"'], [('float', 'g'), ('float', 'b')])
    else:
        L += ['                float inputs:roughness = %s' % p.get('roughnessFactor', 1), '                float inputs:metallic = %s' % p.get('metallicFactor', 1)]
    if 'normalTexture' in m:
        L.append('                normal3f inputs:normal.connect = </Root/Materials/%s/nrm.outputs:rgb>' % nm)
        sh += texshader('nrm', m['normalTexture']['index'], ['                token inputs:sourceColorSpace = "raw"',
                                                           '                float4 inputs:scale = (2, 2, 2, 1)', '                float4 inputs:bias = (-1, -1, -1, 0)'], [('float3', 'rgb')])
    L += ['                token outputs:surface', '            }'] + sh + ['        }']
L.append('    }')
for ni, n in enumerate(j['nodes']):
    mesh = j['meshes'][n['mesh']]
    L.append('    def Xform "%s"\n    {' % sname(n.get('name', 'n%d' % ni)))
    for pi, pr in enumerate(mesh['primitives']):
        a = pr['attributes']; P = acc(a['POSITION']); N = acc(a['NORMAL']) if 'NORMAL' in a else None
        T = acc(a['TEXCOORD_0']) if 'TEXCOORD_0' in a else None
        I = acc(pr['indices']) if 'indices' in pr else list(range(len(P)))
        mn = mnames[pr['material']]
        L += ['        def Mesh "m%d" (\n            prepend apiSchemas = ["MaterialBindingAPI"]\n        )' % pi, '        {', '            uniform bool doubleSided = 1',
              '            int[] faceVertexCounts = [' + ','.join(['3'] * (len(I) // 3)) + ']',
              '            int[] faceVertexIndices = [' + ','.join(map(str, I)) + ']',
              '            point3f[] points = [' + ','.join(tup(x) for x in P) + ']']
        if N: L.append('            normal3f[] normals = [' + ','.join(tup(x) for x in N) + '] (\n                interpolation = "vertex"\n            )')
        if T: L.append('            texCoord2f[] primvars:st = [' + ','.join(tup((u, 1 - v)) for u, v in T) + '] (\n                interpolation = "vertex"\n            )')
        L += ['            rel material:binding = </Root/Materials/%s>' % mn, '            uniform token subdivisionScheme = "none"', '        }']
    L.append('    }')
L.append('}')
usd = '\n'.join(L).encode()
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_STORED) as z:
    for name, data in [('model.usda', usd)] + sorted(files.items()):
        zi = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_STORED
        base = buf.tell() + 30 + len(name)
        pad = (-base) % 64
        if pad and pad < 4: pad += 64
        if pad: zi.extra = struct.pack('<HH', 0x1986, pad - 4) + b'\0' * (pad - 4)
        z.writestr(zi, data)
open(out, 'wb').write(buf.getvalue())
print(out)
PY
  fi
done
