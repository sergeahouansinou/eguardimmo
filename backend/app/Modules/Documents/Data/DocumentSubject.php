<?php

declare(strict_types=1);

namespace App\Modules\Documents\Data;

/**
 * Objet auquel se rattache un fichier ou une pièce : alias de la morph map et identifiant.
 */
final readonly class DocumentSubject
{
    public function __construct(
        public string $type,
        public string $id,
    ) {}
}
