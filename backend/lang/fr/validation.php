<?php

declare(strict_types=1);

return [
    'required' => 'Le champ :attribute est obligatoire.',
    'string' => 'Le champ :attribute doit être un texte.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'confirmed' => 'La confirmation du champ :attribute ne correspond pas.',
    'not_regex' => 'Le format du champ :attribute est invalide.',
    'enum' => 'La valeur choisie pour le champ :attribute est invalide.',
    'in' => 'La valeur choisie pour le champ :attribute est invalide.',
    'uuid' => 'Le champ :attribute doit être un identifiant valide.',
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'array' => 'Le champ :attribute doit être une liste.',
    'unique' => 'La valeur du champ :attribute est déjà utilisée.',
    'max' => [
        'string' => 'Le champ :attribute ne doit pas dépasser :max caractères.',
        'array' => 'Le champ :attribute ne doit pas contenir plus de :max éléments.',
    ],
    'min' => [
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
        'array' => 'Le champ :attribute doit contenir au moins :min éléments.',
    ],
    'attributes' => [
        'name' => 'nom',
        'email' => 'adresse e-mail',
        'password' => 'mot de passe',
        'intended_profile' => 'profil',
    ],
];
