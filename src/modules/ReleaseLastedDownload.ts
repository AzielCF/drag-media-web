interface Asset {
  content_type: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  prerelease: boolean;
  assets: Asset[];
}

interface CacheEntry {
  data: string | null;
  timestamp: number;
}

const serverCache: Record<string, CacheEntry> = {};

const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutos en milisegundos

async function getLinkLastedDownload(user: string, repo: string): Promise<string | null> {
  const contentTypeFilter: string = "application/x-msdos-program";
  const repoUrl: string = `https://api.github.com/repos/${user}/${repo}/releases/latest`;

  // Comprueba si ya tenemos la información en caché en el servidor
  if (serverCache[repoUrl] && Date.now() - serverCache[repoUrl].timestamp < CACHE_EXPIRATION_TIME) {
    console.log("Obteniendo desde la caché del servidor...");
    return serverCache[repoUrl].data;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${import.meta.env.GITHUB_API_KEY}`,
  };

  try {
    const response = await fetch(repoUrl, { headers });
    if (!response.ok) {
      console.error("Error al obtener el release:", response.statusText);
      throw new Error(`Error al obtener el release: ${response.statusText}`);
    }

    const latestRelease: Release = await response.json();

    const assets: Asset[] = latestRelease.assets;
    const matchingAsset: Asset | undefined = assets.find(
      (asset: Asset) => asset.content_type === contentTypeFilter
    );

    if (matchingAsset) {
      const downloadUrl: string = matchingAsset.browser_download_url;

      // Almacena en caché la información junto con la marca de tiempo en el servidor
      serverCache[repoUrl] = { data: downloadUrl, timestamp: Date.now() };

      return downloadUrl;
    } else {
      console.log("No se encontró un activo que coincida con el filtro.");
      return null;
    }
  } catch (error: any) {
    console.error("Error al obtener el release:", error.message);

    // Manejo básico de límite de velocidad: espera 1 minuto y vuelve a intentar
    if (error.message.includes("rate limit exceeded")) {
      console.log("Esperando 1 minuto debido al límite de velocidad...");
      await new Promise(resolve => setTimeout(resolve, 60000)); // Espera 1 minuto
      return getLinkLastedDownload(user, repo); // Intenta nuevamente
    }

    throw error;
  }
}

async function getLinkLastPreRelease(user: string, repo: string): Promise<string | null> {
  const contentTypeFilter: string = "application/x-msdos-program";
  const repoUrl: string = `https://api.github.com/repos/${user}/${repo}/releases`;

  // Comprueba si ya tenemos la información en caché
  if (serverCache[repoUrl] && Date.now() - serverCache[repoUrl].timestamp < CACHE_EXPIRATION_TIME) {
    console.log("Obteniendo desde la caché del servidor...");
    return serverCache[repoUrl].data;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${import.meta.env.GITHUB_API_KEY}`,
  };

  try {
    const response = await fetch(repoUrl, { headers });
    if (!response.ok) {
      console.error("Error al obtener las releases:", response.statusText);
      throw new Error(`Error al obtener las releases: ${response.statusText}`);
    }

    const releases: Release[] = await response.json();

    // Encuentra la última pre-release
    const latestPreRelease = releases.find(release => release.prerelease);
    
    if (!latestPreRelease) {
      console.log("No se encontró ninguna pre-release.");
      return null;
    }

    // Filtra el activo por el tipo de contenido especificado
    const matchingAsset: Asset | undefined = latestPreRelease.assets.find(
      (asset: Asset) => asset.content_type === contentTypeFilter
    );

    if (matchingAsset) {
      const downloadUrl: string = matchingAsset.browser_download_url;

      // Almacena en caché la información junto con la marca de tiempo
      serverCache[repoUrl] = { data: downloadUrl, timestamp: Date.now() };
      return downloadUrl;
    } else {
      console.log("No se encontró un activo que coincida con el filtro.");
      return null;
    }
  } catch (error: any) {
    console.error("Error al obtener las releases:", error.message);

    // Manejo básico de límite de velocidad
    if (error.message.includes("rate limit exceeded")) {
      console.log("Esperando 1 minuto debido al límite de velocidad...");
      await new Promise(resolve => setTimeout(resolve, 60000));
      return getLinkLastPreRelease(user, repo);
    }

    throw error;
  }
}

export { getLinkLastedDownload, getLinkLastPreRelease };
