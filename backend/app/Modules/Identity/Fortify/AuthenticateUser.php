<?php

declare(strict_types=1);

namespace App\Modules\Identity\Fortify;

use App\Modules\Identity\Actions\AttemptPasswordLogin;
use App\Modules\Identity\Enums\LoginChannel;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;

final readonly class AuthenticateUser
{
    private const ATTRIBUT = 'identity.authenticated_user';

    public function __construct(private AttemptPasswordLogin $connexion) {}

    public function __invoke(Request $request): ?User
    {
        if ($request->attributes->has(self::ATTRIBUT)) {
            $deja = $request->attributes->get(self::ATTRIBUT);

            return $deja instanceof User ? $deja : null;
        }

        // Pas de « se souvenir de moi » : le cookie recaller rouvrirait une session après l'expiration absolue.
        $request->merge(['remember' => false]);

        $user = $this->connexion->handle(
            (string) $request->string('email'),
            (string) $request->string('password'),
            LoginChannel::Web,
        );

        $request->attributes->set(self::ATTRIBUT, $user);

        return $user;
    }
}
