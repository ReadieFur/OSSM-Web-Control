import * as htmlToImage from "html-to-image";
import JSZip from "jszip";

document.addEventListener("DOMContentLoaded", () => {
    //#region Generate native logos
    const nativeContainer = document.getElementById("native-container")!;

    const logoElementList: HTMLElement[] = [];

    const logoDarkSquare = document.querySelector<HTMLElement>(".logo")!;
    const baseLogo = logoDarkSquare.cloneNode(true) as HTMLElement;

    // Apply dark theme class
    logoDarkSquare.classList.add("force-theme-dark");
    logoElementList.push(logoDarkSquare);

    // Clone element to create alternate versions
    const logoDarkCircle = baseLogo.cloneNode(true) as HTMLElement;
    logoDarkCircle.classList.add("force-theme-dark");
    logoDarkCircle.classList.add("circle");
    logoElementList.push(logoDarkCircle);

    const logoLightSquare = baseLogo.cloneNode(true) as HTMLElement;
    logoLightSquare.classList.add("force-theme-light");
    logoElementList.push(logoLightSquare);

    const logoLightCircle = baseLogo.cloneNode(true) as HTMLElement;
    logoLightCircle.classList.add("force-theme-light");
    logoLightCircle.classList.add("circle");
    logoElementList.push(logoLightCircle);

    // Append all logos to the document for rendering
    for (let i = 1; i < logoElementList.length; i++)
        nativeContainer.appendChild(logoElementList[i]);
    //#endregion

    const optionsContainer = document.getElementById("output-options")!;
    const possibleSizes = [32, 64, 128, 256, 512];
    for (let i = 0; i < possibleSizes.length; i++) {
        const size = possibleSizes[i];

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = size.toString();
        checkbox.id = `size-checkbox-${size}`;

        const label = document.createElement("label");
        label.textContent = `${size}x${size}`;
        label.htmlFor = checkbox.id;

        optionsContainer.appendChild(checkbox);
        optionsContainer.appendChild(label);
    }
    const exportButton = document.createElement("button");
    exportButton.id = "export-button";
    exportButton.textContent = "Export selected PNGs";
    optionsContainer.appendChild(exportButton);

    //#region Generate images
    // const outputContainer = document.getElementById("output-container")!;
    // logoElementList.forEach((element, index) => {
    //     htmlToImage.toPng(element)
    //         .then((dataUrl) => {
    //             const img = new Image();
    //             img.src = dataUrl;
    //             outputContainer.appendChild(img);
    //         })
    //         .catch((error) => {
    //             console.error("Error generating logo image:", error);
    //         });
    // });

    exportButton.addEventListener("click", async () => {
        console.log("Exporting logos...");
        document.body.insertAdjacentHTML("beforeend", `<p>Exporting logos...</p>`);

        const zip = new JSZip();

        const sizes: number[] = [];
        for (const element in optionsContainer.querySelectorAll<HTMLInputElement>("input[type='checkbox']")) {
            const checkbox = optionsContainer.querySelectorAll<HTMLInputElement>("input[type='checkbox']")[element];
            if (checkbox.checked) {
                const size = parseInt(checkbox.value, 10);
                sizes.push(size);
            }
        }

        // CBA to make this reusable, one time use page, reload page for reset
        optionsContainer.remove();

        if (sizes.length === 0) {
            document.body.insertAdjacentHTML("beforeend", `<p style="color: red;">No sizes selected. Please select at least one size.</p>`);
            return;
        }

        for (const size of sizes) {
            for (let i = 0; i < logoElementList.length; i++) {
                const element = logoElementList[i];
                try {
                    element.style.setProperty("--width", `${size}px`);
                    element.style.setProperty("--height", `${size}px`);
                    const dataUrl = await htmlToImage.toPng(element, {
                        width: size,
                        height: size,
                    });
                    const base64Data = dataUrl.split(",")[1];
                    const theme = element.classList.contains("force-theme-dark") ? "dark" : "light";
                    const shape = element.classList.contains("circle") ? "circle" : "square";
                    const fileName = `logo_${theme}_${shape}_${size}x${size}.png`;
                    zip.file(fileName, base64Data, { base64: true });
                    console.log(`Generated logo image: ${fileName}`);
                } catch (error) {
                    console.error(`Error generating logo image (${size}x${size}):`, error);
                    document.body.insertAdjacentHTML("beforeend", `<p style="color: red;">Error generating logo image (${size}x${size}): ${error}</p>`);
                    return;
                }
            }
        }

        try {
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "ossm_logos.zip";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            document.body.insertAdjacentHTML("beforeend", `<p style="color: green;">Logos exported successfully!</p>`);
        } catch (error) {
            console.error("Error generating ZIP file:", error);
            document.body.insertAdjacentHTML("beforeend", `<p style="color: red;">Error generating ZIP file: ${error}</p>`);
        }
    }, { once: true });
    //#endregion
});
