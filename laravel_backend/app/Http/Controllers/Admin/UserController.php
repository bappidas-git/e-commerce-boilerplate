<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        return $this->ok(User::orderByDesc('id')->get());
    }

    public function show($id)
    {
        return $this->ok(User::findOrFail($id));
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'isActive' => ['sometimes', 'boolean'],
            'firstName' => ['sometimes', 'string', 'max:100'],
            'lastName' => ['sometimes', 'string', 'max:100'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'storeCredit' => ['sometimes', 'integer'],
        ]);

        $user->fill($data);
        $user->updatedAt = Carbon::now('UTC');
        $user->save();

        return $this->ok($user);
    }
}
