<?php

declare(strict_types=1);

namespace App\Modules\Identity\Enums;

use App\Shared\Http\ApiProblem;

enum ErrorCode: string
{
    case NoAccount = 'no_account';
    case AccountExistsLinkRequired = 'account_exists_link_required';
    case IdentityAlreadyLinked = 'identity_already_linked';
    case ProviderAlreadyLinked = 'provider_already_linked';
    case EmailRequired = 'email_required';
    case InvalidIdToken = 'invalid_id_token';
    case ProviderUnavailable = 'provider_unavailable';
    case InvalidState = 'invalid_state';
    case ProviderError = 'provider_error';
    case EmailUnverified = 'email_unverified';
    case SpaceForbidden = 'space_forbidden';
    case OperatorTokenRequired = 'operator_token_required';
    case ReauthenticationRequired = 'reauthentication_required';
    case NoTokenToRevoke = 'no_token_to_revoke';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(): ApiProblem
    {
        $entetes = $this === self::ProviderUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::NoAccount => 404,
            self::AccountExistsLinkRequired, self::IdentityAlreadyLinked, self::ProviderAlreadyLinked => 409,
            self::EmailRequired, self::InvalidIdToken, self::NoTokenToRevoke => 422,
            self::ProviderUnavailable => 503,
            self::ProviderError => 502,
            self::InvalidState, self::EmailUnverified, self::SpaceForbidden, self::OperatorTokenRequired, self::ReauthenticationRequired => 403,
        };
    }

    public function title(): string
    {
        return match ($this) {
            self::NoAccount => 'Aucun compte',
            self::AccountExistsLinkRequired => 'Compte existant',
            self::IdentityAlreadyLinked => 'Identité déjà liée',
            self::ProviderAlreadyLinked => 'Fournisseur déjà lié',
            self::EmailRequired => 'Adresse e-mail manquante',
            self::InvalidIdToken => 'Jeton d\'identité invalide',
            self::ProviderUnavailable => 'Fournisseur injoignable',
            self::InvalidState => 'Connexion expirée',
            self::ProviderError => 'Erreur du fournisseur',
            self::EmailUnverified => 'Adresse e-mail non vérifiée',
            self::SpaceForbidden => 'Espace non autorisé',
            self::OperatorTokenRequired => 'Jeton console requis',
            self::ReauthenticationRequired => 'Confirmation requise',
            self::NoTokenToRevoke => 'Aucun jeton à révoquer',
        };
    }

    public function detail(): string
    {
        return match ($this) {
            self::NoAccount => 'Aucun compte n\'est associé à cette identité. Créez un compte.',
            self::AccountExistsLinkRequired => 'Un compte existe déjà avec cette adresse. Connectez-vous, puis liez ce fournisseur depuis votre profil.',
            self::IdentityAlreadyLinked => 'Cette identité est déjà liée à un autre compte.',
            self::ProviderAlreadyLinked => 'Un autre compte de ce fournisseur est déjà lié à votre profil.',
            self::EmailRequired => 'Le fournisseur n\'a transmis aucune adresse e-mail.',
            self::InvalidIdToken => 'Le jeton d\'identité est invalide ou a déjà été utilisé. Reconnectez-vous.',
            self::ProviderUnavailable => 'Le fournisseur d\'identité est momentanément injoignable. Réessayez.',
            self::InvalidState => 'La demande de connexion est invalide ou expirée. Recommencez.',
            self::ProviderError => 'Le fournisseur d\'identité a refusé la connexion. Recommencez.',
            self::EmailUnverified => 'Confirmez votre adresse e-mail pour accéder à cet espace.',
            self::SpaceForbidden => 'Vous n\'avez pas accès à cet espace.',
            self::OperatorTokenRequired => 'Un jeton console est requis.',
            self::ReauthenticationRequired => 'Confirmez votre identité pour continuer.',
            self::NoTokenToRevoke => 'Cette requête utilise une session : aucun jeton à révoquer.',
        };
    }
}
