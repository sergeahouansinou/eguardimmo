<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use Illuminate\Console\Command;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;

final class ServerTwoFactorPrompt
{
    /**
     * @return array{secret: string, code: string}
     */
    public static function ask(Command $commande, TwoFactorAuthenticationProvider $fournisseur, string $email): array
    {
        $secret = $fournisseur->generateSecretKey();
        $application = config('app.name');

        $commande->line('Le titulaire ajoute ce compte dans son application d\'authentification, sans transmettre cette clé par messagerie.');
        $commande->line("Clé secrète : {$secret}");
        $commande->line('Lien : '.$fournisseur->qrCodeUrl(is_string($application) ? $application : 'eGuardImmo', $email, $secret));

        $code = $commande->secret('Code à 6 chiffres affiché par l\'application du titulaire');

        return ['secret' => $secret, 'code' => is_string($code) ? $code : ''];
    }

    /**
     * @param  list<string>  $codes
     */
    public static function showRecoveryCodes(Command $commande, array $codes): void
    {
        $commande->info('Double authentification activée. Codes de secours, affichés une seule fois :');

        foreach ($codes as $code) {
            $commande->line($code);
        }

        $commande->warn('Effacez l\'historique du terminal après les avoir remis au titulaire.');
    }
}
