<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

/**
 * Comment l'identité du titulaire a été vérifiée avant une réinitialisation de sa double authentification ; aucune pièce n'est conservée.
 */
enum VerificationMethod: string
{
    case KnownChannel = 'known_channel';
    case VideoCall = 'video_call';
    case DocumentSeen = 'document_seen';
}
