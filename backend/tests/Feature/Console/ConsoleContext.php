<?php

declare(strict_types=1);

namespace Tests\Feature\Console;

use App\Modules\Identity\Models\User;
use Illuminate\Testing\TestResponse;

final class ConsoleContext
{
    public const string UUID_INCONNU = '00000000-0000-7000-8000-000000000000';

    /**
     * Opérateur avec jeton console. Sans rôle ni double authentification quand on le demande.
     *
     * @param  list<string>  $roles
     * @return array{user: User, jeton: string}
     */
    public static function operateur(array $roles = ['admin'], string $nom = 'Opérateur', bool $deuxFacteurs = true, ?string $email = null): array
    {
        $user = User::factory()->create(['name' => $nom, ...($email === null ? [] : ['email' => $email])]);
        $operateur = $user->operator()->create(['granted_at' => now()]);

        foreach ($roles as $role) {
            $operateur->roles()->create(['role' => $role, 'granted_at' => now()]);
        }

        if ($deuxFacteurs) {
            activerDeuxFacteurs($user);
        }

        return ['user' => $user, 'jeton' => $user->createToken('console', ['operator'])->plainTextToken];
    }

    /**
     * Un jeton opérateur n'est lu que sur une requête sans origine d'application web : sinon Sanctum ne regarde que la session.
     */
    public static function reinitialiser(mixed $test): void
    {
        auth()->forgetGuards();
        $test->withoutHeaders(['Origin', 'Referer', 'Authorization']);
    }

    /**
     * @param  array<string, mixed>  $corps
     */
    public static function lire(mixed $test, string $jeton, string $url): TestResponse
    {
        self::reinitialiser($test);

        return $test->withToken($jeton)->getJson($url);
    }

    /**
     * Écriture avec une preuve TOTP fraîche.
     *
     * @param  array<string, mixed>  $corps
     */
    public static function ecrire(mixed $test, string $jeton, string $methode, string $url, array $corps = []): TestResponse
    {
        self::reinitialiser($test);

        return $test->withToken($jeton)->json($methode, $url, avecPreuve($jeton, $corps));
    }

    /**
     * Écriture sans preuve : la preuve est fournie par l'appelant (code rejoué, faux, de secours).
     *
     * @param  array<string, mixed>  $corps
     */
    public static function ecrireBrut(mixed $test, string $jeton, string $methode, string $url, array $corps = []): TestResponse
    {
        self::reinitialiser($test);

        return $test->withToken($jeton)->json($methode, $url, $corps);
    }
}
