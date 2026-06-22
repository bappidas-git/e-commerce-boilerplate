<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Admin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $admin = Admin::whereRaw('LOWER(email) = ?', [strtolower(trim($data['email']))])->first();
        if (! $admin || ! Hash::check($data['password'], $admin->password)) {
            return $this->fail('Invalid email or password', 401);
        }
        if (! $admin->isActive) {
            return $this->fail('This account has been deactivated', 401);
        }

        $token = $admin->createToken('admin', ['admin'])->plainTextToken;

        return $this->ok(['token' => $token, 'admin' => $admin]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return $this->ok(['success' => true]);
    }
}
