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
    case OperatorTokenForbidden = 'operator_token_forbidden';
    case ReauthenticationRequired = 'reauthentication_required';
    case NoTokenToRevoke = 'no_token_to_revoke';
    case EmailVerificationLinkInvalid = 'email_verification_link_invalid';
    case TenantInvitationInvalid = 'tenant_invitation_invalid';
    case TenantInvitationEmailMismatch = 'tenant_invitation_email_mismatch';
    case TenantInvitationConsentRequired = 'tenant_invitation_consent_required';
    case TenantAccessAlreadyGranted = 'tenant_access_already_granted';
    case OwnerInvitationInvalid = 'owner_invitation_invalid';
    case OwnerInvitationEmailMismatch = 'owner_invitation_email_mismatch';
    case OwnerInvitationCodeInvalid = 'owner_invitation_code_invalid';
    case OwnerInvitationConsentRequired = 'owner_invitation_consent_required';
    case InvitationDailyLimitReached = 'invitation_daily_limit_reached';
    case EmailChangeCodeInvalid = 'email_change_code_invalid';
    case EmailChangeAttemptsExceeded = 'email_change_attempts_exceeded';
    case PhoneInvalid = 'phone_invalid';
    case OperatorRoleRequired = 'operator_role_required';
    case OperatorProofRequired = 'operator_proof_required';
    case OperatorProofInvalid = 'operator_proof_invalid';
    case OperatorAccountProtected = 'operator_account_protected';
    case AccountSuspended = 'account_suspended';
    case AccountNotFound = 'account_not_found';
    case AccountAlreadySuspended = 'account_already_suspended';
    case AccountNotSuspended = 'account_not_suspended';
    case TwoFactorNotEnabled = 'two_factor_not_enabled';
    case TwoFactorAlreadyEnabled = 'two_factor_already_enabled';
    case SuspensionReviewForbidden = 'suspension_review_forbidden';
    case LastOperatorAdministrator = 'last_operator_administrator';

    private const RETRY_AFTER_SECONDES = 30;

    public function problem(): ApiProblem
    {
        $entetes = $this === self::ProviderUnavailable ? ['Retry-After' => (string) self::RETRY_AFTER_SECONDES] : [];

        return new ApiProblem($this->value, $this->status(), $this->title(), $this->detail(), $entetes);
    }

    public function status(): int
    {
        return match ($this) {
            self::NoAccount, self::TenantInvitationInvalid, self::OwnerInvitationInvalid, self::AccountNotFound => 404,
            self::AccountExistsLinkRequired, self::IdentityAlreadyLinked, self::ProviderAlreadyLinked, self::TenantAccessAlreadyGranted, self::AccountAlreadySuspended, self::AccountNotSuspended, self::TwoFactorNotEnabled, self::TwoFactorAlreadyEnabled, self::LastOperatorAdministrator => 409,
            self::EmailRequired, self::InvalidIdToken, self::NoTokenToRevoke, self::TenantInvitationConsentRequired, self::OwnerInvitationCodeInvalid, self::OwnerInvitationConsentRequired, self::EmailChangeCodeInvalid, self::PhoneInvalid, self::OperatorProofRequired, self::OperatorProofInvalid => 422,
            self::InvitationDailyLimitReached, self::EmailChangeAttemptsExceeded => 429,
            self::ProviderUnavailable => 503,
            self::ProviderError => 502,
            self::InvalidState, self::EmailUnverified, self::SpaceForbidden, self::OperatorTokenRequired, self::OperatorTokenForbidden, self::ReauthenticationRequired, self::EmailVerificationLinkInvalid, self::TenantInvitationEmailMismatch, self::OwnerInvitationEmailMismatch, self::OperatorRoleRequired, self::OperatorAccountProtected, self::AccountSuspended, self::SuspensionReviewForbidden => 403,
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
            self::OperatorTokenForbidden => 'Jeton console non autorisé',
            self::ReauthenticationRequired => 'Confirmation requise',
            self::NoTokenToRevoke => 'Aucun jeton à révoquer',
            self::EmailVerificationLinkInvalid => 'Lien de confirmation invalide',
            self::TenantInvitationInvalid => 'Invitation invalide',
            self::TenantInvitationEmailMismatch => 'Invitation destinée à une autre adresse',
            self::TenantInvitationConsentRequired => 'Consentement requis',
            self::TenantAccessAlreadyGranted => 'Accès déjà accordé',
            self::OwnerInvitationInvalid => 'Invitation invalide',
            self::OwnerInvitationEmailMismatch => 'Invitation destinée à une autre adresse',
            self::OwnerInvitationCodeInvalid => 'Code d\'appariement invalide',
            self::OwnerInvitationConsentRequired => 'Consentement requis',
            self::InvitationDailyLimitReached => 'Trop d\'invitations aujourd\'hui',
            self::EmailChangeCodeInvalid => 'Code invalide',
            self::EmailChangeAttemptsExceeded => 'Trop d\'essais',
            self::PhoneInvalid => 'Numéro de téléphone invalide',
            self::OperatorRoleRequired => 'Rôle opérateur requis',
            self::OperatorProofRequired => 'Code de double authentification requis',
            self::OperatorProofInvalid => 'Code de double authentification invalide',
            self::OperatorAccountProtected => 'Compte opérateur protégé',
            self::AccountSuspended => 'Compte suspendu',
            self::AccountNotFound => 'Compte introuvable',
            self::AccountAlreadySuspended => 'Compte déjà suspendu',
            self::AccountNotSuspended => 'Compte non suspendu',
            self::TwoFactorNotEnabled => 'Double authentification non activée',
            self::TwoFactorAlreadyEnabled => 'Double authentification déjà activée',
            self::SuspensionReviewForbidden => 'Revue de suspension refusée',
            self::LastOperatorAdministrator => 'Dernier administrateur de la console',
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
            self::OperatorTokenForbidden => 'Un jeton console ne donne accès qu\'à la console.',
            self::ReauthenticationRequired => 'Confirmez votre identité pour continuer.',
            self::NoTokenToRevoke => 'Cette requête utilise une session : aucun jeton à révoquer.',
            self::EmailVerificationLinkInvalid => 'Ce lien est invalide, expiré ou déjà utilisé.',
            self::TenantInvitationInvalid => 'Cette invitation est invalide, expirée ou déjà utilisée.',
            self::TenantInvitationEmailMismatch => 'Connectez-vous avec l\'adresse e-mail qui a reçu l\'invitation, après l\'avoir confirmée.',
            self::TenantInvitationConsentRequired => 'Acceptez le rattachement de votre compte à votre dossier de location pour continuer.',
            self::TenantAccessAlreadyGranted => 'Ce contact est déjà rattaché à un compte : révoquez l\'accès avant d\'en inviter un autre.',
            self::OwnerInvitationInvalid => 'Cette invitation est invalide, expirée, bloquée ou déjà utilisée.',
            self::OwnerInvitationEmailMismatch => 'Connectez-vous avec l\'adresse e-mail qui a reçu l\'invitation, après l\'avoir confirmée.',
            self::OwnerInvitationCodeInvalid => 'Le code d\'appariement est incorrect. Après cinq erreurs, l\'invitation est bloquée : demandez-en une nouvelle à votre agence.',
            self::OwnerInvitationConsentRequired => 'Acceptez le rattachement de votre compte à votre dossier de propriétaire pour continuer.',
            self::InvitationDailyLimitReached => 'Cette organisation a atteint le nombre d\'invitations autorisé sur vingt-quatre heures. Réessayez plus tard.',
            self::EmailChangeCodeInvalid => 'Ce code est incorrect, expiré, ou l\'adresse n\'est pas utilisable. Recommencez la demande de changement.',
            self::EmailChangeAttemptsExceeded => 'Trop de codes erronés : la demande est bloquée, recommencez-la.',
            self::PhoneInvalid => 'Saisissez un numéro au format international, par exemple +33612345678.',
            self::OperatorRoleRequired => 'Votre rôle d\'opérateur ne permet pas cette opération.',
            self::OperatorProofRequired => 'Saisissez un code de double authentification pour confirmer cette opération.',
            self::OperatorProofInvalid => 'Ce code de double authentification est incorrect ou a déjà été utilisé.',
            self::OperatorAccountProtected => 'Un compte opérateur ne se modifie pas depuis la console.',
            self::AccountSuspended => 'Ce compte est suspendu. Contactez le support de eGuardImmo.',
            self::AccountNotFound => 'Aucun compte ne correspond à cette recherche.',
            self::AccountAlreadySuspended => 'Ce compte est déjà suspendu.',
            self::AccountNotSuspended => 'Ce compte n\'est pas suspendu.',
            self::TwoFactorNotEnabled => 'Ce compte n\'a pas de double authentification confirmée.',
            self::TwoFactorAlreadyEnabled => 'La double authentification est déjà confirmée : désactivez-la avant d\'en créer une nouvelle.',
            self::LastOperatorAdministrator => 'Ce changement retirerait le dernier opérateur administrateur : la console n\'aurait plus personne pour attribuer les rôles et valider. Ajoutez d\'abord un autre administrateur, ou confirmez avec --force.',
            self::SuspensionReviewForbidden => 'La revue d\'une suspension revient à un autre opérateur que celui qui l\'a prononcée.',
        };
    }
}
