<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Support\FileInspector;
use App\Modules\Documents\Support\FileNames;

/**
 * Contrôles d'une pièce stockée hors du stockage probant (support, messagerie) : mêmes règles de contenu et de nom que les dépôts Documents.
 */
final readonly class AttachmentInspector
{
    /**
     * Refus d'un type hors liste, d'un fichier trop gros ou d'un polyglotte contenant du code PHP.
     */
    public function problem(string $chemin): ?ErrorCode
    {
        return FileInspector::problem($chemin, FileCategory::Supporting);
    }

    /**
     * Nom sans caractère de contrôle ni de direction du texte, dont l'extension suit le type détecté (un PDF nommé `x.html` ressort `x.pdf`).
     */
    public function displayName(string $nom, string $type): string
    {
        $extension = FileCategory::Supporting->allowedTypes()[$type] ?? null;

        if ($extension === null) {
            return FileNames::display($nom);
        }

        return FileNames::aligned($nom, $type === 'image/jpeg' ? ['jpg', 'jpeg'] : [$extension]);
    }
}
