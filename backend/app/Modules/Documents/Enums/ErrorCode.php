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
    case EarlyPurgeRefused = 'early_purge_refused';
    case SubjectNotFound = 'subject_not_found';
    case CertificateNotFound = 'certificate_not_found';
    case CertificateAlreadyReplaced = 'certificate_already_replaced';
    case CertificateSchemaInvalid = 'certificate_schema_invalid';
    case BundleEmpty = 'bundle_empty';
    case ZipUnavailable = 'zip_unavailable';
    case AttachmentNotReady = 'attachment_not_ready';
    case AttachmentInfected = 'attachment_infected';
    case DocumentNotClean = 'document_not_clean';
    case LibraryDocumentNotFound = 'library_document_not_found';
    case LibraryKindSubjectMismatch = 'library_kind_subject_mismatch';

    public function problem(): ApiProblem
    {
        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail());
    }

    public function status(): int
    {
        return match ($this) {
            self::FileNotFound, self::SubjectNotFound, self::CertificateNotFound, self::LibraryDocumentNotFound => 404,
            self::FileUnavailable, self::ZipUnavailable => 500,
            self::FileTypeRefused, self::FileTooLarge, self::FileUnsafe, self::CertificateSchemaInvalid, self::BundleEmpty, self::LibraryKindSubjectMismatch => 422,
            self::RetentionActive, self::EarlyPurgeRefused, self::CertificateAlreadyReplaced, self::AttachmentNotReady, self::DocumentNotClean => 409,
            self::AttachmentInfected => 410,
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
            self::EarlyPurgeRefused => 'Suppression anticipée refusée',
            self::SubjectNotFound => 'Objet introuvable',
            self::CertificateNotFound => 'Pièce introuvable',
            self::CertificateAlreadyReplaced => 'Pièce déjà remplacée',
            self::CertificateSchemaInvalid => 'Schéma du type invalide',
            self::BundleEmpty => 'Paquet vide',
            self::ZipUnavailable => 'Archive indisponible',
            self::AttachmentNotReady => 'Pièce en cours d\'analyse',
            self::AttachmentInfected => 'Pièce infectée',
            self::DocumentNotClean => 'Fichier non analysé',
            self::LibraryDocumentNotFound => 'Document introuvable',
            self::LibraryKindSubjectMismatch => 'Nature et objet incohérents',
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
            self::EarlyPurgeRefused => 'Ce fichier a une conservation légale : il ne se supprime pas avant son échéance.',
            self::SubjectNotFound => 'Cet objet n\'existe pas dans votre organisation ou ne peut pas porter de pièce.',
            self::CertificateNotFound => 'Cette pièce n\'existe pas dans votre organisation.',
            self::CertificateAlreadyReplaced => 'Cette pièce a déjà été renouvelée : renouvelez la pièce la plus récente.',
            self::CertificateSchemaInvalid => 'Le schéma de données de ce type de pièce est invalide ; contactez un administrateur.',
            self::BundleEmpty => 'Un paquet contient au moins un fichier.',
            self::ZipUnavailable => 'L\'extension de création d\'archives est absente du serveur.',
            self::AttachmentNotReady => 'Cette pièce n\'a pas encore été analysée : réessayez dans quelques instants.',
            self::AttachmentInfected => 'Cette pièce contenait un logiciel malveillant : elle a été mise en quarantaine.',
            self::DocumentNotClean => 'Ce fichier n\'a pas fini son analyse antivirale ou n\'est pas sain : il ne peut pas être partagé ni utilisé comme preuve.',
            self::LibraryDocumentNotFound => 'Ce document n\'existe pas dans la bibliothèque de votre organisation.',
            self::LibraryKindSubjectMismatch => 'Cette nature de document impose un objet précis : un mandat pour un mandat, un bail pour un bail.',
        };
    }
}
