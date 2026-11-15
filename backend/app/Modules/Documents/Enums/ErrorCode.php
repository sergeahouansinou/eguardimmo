<?php

declare(strict_types=1);

namespace App\Modules\Documents\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case FileNotFound = 'file_not_found';
    case FileUnavailable = 'file_unavailable';
    case FileTypeRefused = 'file_type_refused';
    case FileTooLarge = 'file_too_large';
    case FileUnsafe = 'file_unsafe';
    case RetentionActive = 'retention_active';
    case SubjectNotFound = 'subject_not_found';
    case CertificateNotFound = 'certificate_not_found';
    case CertificateAlreadyReplaced = 'certificate_already_replaced';
    case CertificateSchemaInvalid = 'certificate_schema_invalid';
    case BundleEmpty = 'bundle_empty';
    case ZipUnavailable = 'zip_unavailable';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::FileNotFound, self::SubjectNotFound, self::CertificateNotFound => 404,
            self::FileUnavailable, self::ZipUnavailable => 500,
            self::FileTypeRefused, self::FileTooLarge, self::FileUnsafe, self::CertificateSchemaInvalid, self::BundleEmpty => 422,
            self::RetentionActive, self::CertificateAlreadyReplaced => 409,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::FileNotFound => 'Fichier introuvable',
            self::FileUnavailable => 'Fichier indisponible',
            self::FileTypeRefused => 'Type de fichier refusé',
            self::FileTooLarge => 'Fichier trop volumineux',
            self::FileUnsafe => 'Fichier refusé',
            self::RetentionActive => 'Conservation en cours',
            self::SubjectNotFound => 'Objet introuvable',
            self::CertificateNotFound => 'Pièce introuvable',
            self::CertificateAlreadyReplaced => 'Pièce déjà remplacée',
            self::CertificateSchemaInvalid => 'Schéma du type invalide',
            self::BundleEmpty => 'Paquet vide',
            self::ZipUnavailable => 'Archive indisponible',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::FileNotFound => 'Ce fichier n\'existe pas dans votre organisation.',
            self::FileUnavailable => 'Le contenu de ce fichier est introuvable ; l\'incident est signalé.',
            self::FileTypeRefused => 'Ce type de fichier n\'est pas accepté ici.',
            self::FileTooLarge => 'Ce fichier dépasse la taille maximale autorisée.',
            self::FileUnsafe => 'Ce fichier contient du code exécutable.',
            self::RetentionActive => 'Ce fichier est conservé jusqu\'à la fin de sa durée de conservation.',
            self::SubjectNotFound => 'Cet objet n\'existe pas dans votre organisation ou ne peut pas porter de pièce.',
            self::CertificateNotFound => 'Cette pièce n\'existe pas dans votre organisation.',
            self::CertificateAlreadyReplaced => 'Cette pièce a déjà été renouvelée : renouvelez la pièce la plus récente.',
            self::CertificateSchemaInvalid => 'Le schéma de données de ce type de pièce est invalide ; contactez un administrateur.',
            self::BundleEmpty => 'Un paquet contient au moins un fichier.',
            self::ZipUnavailable => 'L\'extension de création d\'archives est absente du serveur.',
        };
    }
}
