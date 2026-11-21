<?php

declare(strict_types=1);

namespace App\Modules\Operations\Support;

/**
 * Valeurs effectives non secrètes : la configuration reste déployée (`.env`, revue), la console la lit sans jamais la modifier. Aucun hôte
 * interne, chemin, clé, secret ni version.
 */
final class EffectiveSettings
{
    /**
     * @return array<string, array<string, mixed>>
     */
    public function all(): array
    {
        return [
            'console' => [
                'token_ttl_minutes' => (int) config('identity.console_token_ttl_minutes'),
                'session_absolute_minutes' => (int) config('identity.operator_session_absolute_minutes'),
                'reauthentication_minutes' => (int) config('identity.reauthentication_minutes'),
            ],
            'sessions' => [
                'web_absolute_minutes' => (int) config('identity.session_absolute_minutes'),
            ],
            'support' => [
                'hours' => (string) config('messaging.support.hours'),
                'timezone' => (string) config('messaging.support.timezone'),
                'response_label' => (string) config('messaging.support.response_label'),
            ],
            'broadcasts' => [
                'daily_recipients' => (int) config('notifications.campaigns.daily_recipients'),
                'hourly_sends' => (int) config('notifications.campaigns.hourly_sends'),
                'hourly_tests' => (int) config('notifications.campaigns.hourly_tests'),
            ],
            'antivirus' => [
                'enabled' => in_array((string) config('documents.malware.scanner'), ['clamd', 'fake'], true),
            ],
            'mail' => [
                'configured' => ! in_array((string) config('mail.default'), ['log', 'array', 'null', ''], true),
            ],
            'payments' => [
                'gateway' => match ((string) config('payments.gateway')) {
                    'none' => 'none',
                    'fake' => 'fake',
                    default => 'provider',
                },
            ],
            'approvals' => [
                'ttl_hours' => (int) config('operations.approval_ttl_hours'),
            ],
            'privacy' => [
                'export_ttl_days' => (int) config('privacy.export_ttl_days'),
            ],
            'backups' => [
                'max_age_hours' => (int) config('operations.backup_max_age_hours'),
            ],
        ];
    }
}
