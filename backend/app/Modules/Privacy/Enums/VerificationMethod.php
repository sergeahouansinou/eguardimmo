<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Enums;

/**
 * Comment l'identité du demandeur a été établie ; aucune pièce n'est conservée.
 */
enum VerificationMethod: string
{
    case AccountSession = 'account_session';
    case KnownChannel = 'known_channel';
    case VideoCall = 'video_call';
    case DocumentSeen = 'document_seen';
}
