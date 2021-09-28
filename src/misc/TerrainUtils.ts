import { NodeData } from 'earth-3d';
import { Vector3, MathUtils, Mesh, TextureLoader, DataTexture, RGBFormat, UnsignedShort565Type, BufferGeometry, ShaderMaterial, Uint16BufferAttribute, Float32BufferAttribute, Color } from 'three';

export interface Cartographic {
    latitude: number;
    longitude: number;
    height: number;
}

export class TerrainUtils {
    static WORLD_RADIUS = 6371010;

    static VertexShader = `
        uniform vec2 uv_offset;
        uniform vec2 uv_scale;
        uniform bool octant_mask[8];
        attribute float octant;	
        attribute vec2 texcoords;		
        varying vec2 v_texcoords;

        void main() {
            float mask = octant_mask[int(octant)] ? 0.0 : 1.0;
            v_texcoords = (texcoords + uv_offset) * uv_scale * mask;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ) * mask;
        }
    `;

    static FragmentShader = `
        #ifdef GL_ES
            precision mediump float;
        #endif
        uniform sampler2D textureMap;
        varying vec2 v_texcoords;

        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        
        void main() {
            gl_FragColor = vec4(texture2D(textureMap, v_texcoords).rgb, 1.0);
            
            // gl_FragColor.rgb *= vec3(0.5,0.5,0.5);


            #ifdef USE_FOG
                float depth = gl_FragCoord.z / gl_FragCoord.w;
                float fogFactor = smoothstep( fogNear, fogFar, depth );
                gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
            #endif
        }
    `;

    public static GetMeshOctantMask(mask: number): Array<number> {
        return [
            (mask >> 0) & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1,
            (mask >> 4) & 1, (mask >> 5) & 1, (mask >> 6) & 1, (mask >> 7) & 1
        ];
    }

    public static SetMeshOctantMask(mesh: Mesh, mask: number) {
        const material: ShaderMaterial = mesh.material as ShaderMaterial;
        if (!material || !material.uniforms) return;
        material.uniforms.octant_mask.value = TerrainUtils.GetMeshOctantMask(mask);
        material.uniformsNeedUpdate = true;
    }

    public static NodeToTHREE(node: NodeData, mesh_only: boolean): Array<Mesh> | null {
        if (!node.data.meshes || node.data.meshes.length == 0) {
            return null;
        }

        let threeMeshes: Array<Mesh> = [];

        for (let meshe of node.data.meshes) {
            const geometry = new BufferGeometry();
            geometry.setIndex(new Uint16BufferAttribute(meshe.indices, 1));
            geometry.setAttribute("position", new Float32BufferAttribute(meshe.vertices, 3));

            let material;
            if (!mesh_only) {
                geometry.setAttribute("octant", new Float32BufferAttribute(meshe.octants, 1))
                geometry.setAttribute("texcoords", new Float32BufferAttribute(meshe.vertices_uvs, 2))
    
                // Texture
                const texture = meshe.texture[0];
                const texture_format = texture.format;

                let texture_map;

                if (texture_format == 1) { // JPG
                    const blob = new Blob([texture.data[0]]);
                    let url =  window.URL.createObjectURL(blob);
                    texture_map = new TextureLoader().load( url );     
                }
                else if (texture_format == 6) { // DXT
                    texture_map = new DataTexture(texture.data[0], texture.width, texture.height, RGBFormat, UnsignedShort565Type);

                }

                material = new ShaderMaterial( {
                    uniforms: {
                        textureMap: { value: texture_map },
                        uv_offset: { value: meshe.uv_offset },
                        uv_scale: { value: meshe.uv_scale },
                        octant_mask: { value: [0, 0, 0, 0, 0, 0, 0] },

                        // fogColor:    { value: new Color(0,0,0) },
                        // fogNear:     { value: 1 },
                        // fogFar:      { value: 10 }
                    },
                    // wireframe: false,
                    // depthWrite: false,
                    // depthTest: false,
                    // fog: true,
                    vertexShader: TerrainUtils.VertexShader,
                    fragmentShader: TerrainUtils.FragmentShader,
                } );
            }

            // Mesh
            const mesh = new Mesh(geometry, material);

            threeMeshes.push(mesh);
        }

        return threeMeshes;
    }

    static IPCoordinates(): Promise<Cartographic> {
        return fetch("https://json.geoiplookup.io/")
        .then(response => response.json())
        .then(data => {
            return {
                latitude: data["latitude"],
                longitude: data["longitude"],
                height: 0
            }
        })
        .catch((error) => {
            console.error(error);
            return null;
        });
    }

    static CartographicAltitude(lat, lon): Promise<number> {
        return fetch(`https://cors.bridged.cc/https://www.mapcoordinates.net/admin/component/edit/Vpc_MapCoordinates_Advanced_GoogleMapCoords_Component/Component/json-get-elevation?latitude=${lat}&longitude=${lon}`, {
            method: "POST",
        })
        .then(response => {
            if (response.ok) return response.json()
            throw new Error('Network response was not ok.')
        })
        .then(data => {
            if (data["elevation"]) {
                return data["elevation"]
            }
            return null
        })
        .catch(error => {
            console.error(error);
            return null;
        })
    }

    static CartesianToCartographic(x, y, z): Cartographic {
        const height = Math.sqrt(x * x + y * y + z * z);
        const lat = Math.asin(z / height) * MathUtils.RAD2DEG;
        const lon = Math.atan2(y, x) * MathUtils.RAD2DEG;

        return {
            latitude: lat,
            longitude: lon,
            height: height
        }
    }

    static CartographicToCartesian(lat, lon, height): Vector3 {
        const x = height * Math.cos(lat * MathUtils.DEG2RAD) * Math.cos(lon * MathUtils.DEG2RAD);
        const y = height * Math.cos(lat * MathUtils.DEG2RAD) * Math.sin(lon * MathUtils.DEG2RAD);
        const z = height * Math.sin(lat * MathUtils.DEG2RAD)

        return new Vector3(x, y, z);
    }
}